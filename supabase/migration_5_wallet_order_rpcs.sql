-- ============================================================
-- SUT CarryBuddy — Migration 5: เพิ่ม RPC สำหรับเงินใน Wallet และสถานะออเดอร์
-- ============================================================

-- RPC: ล็อกเงินจาก Wallet ของผู้ฝากเป็นมัดจำก่อนให้ Runner รับงาน
create or replace function public.lock_order_escrow(p_order_id bigint, p_total_amount numeric)
returns void as $$
declare
  v_order record;
  v_wallet record;
begin
  select * into v_order from public.orders where id = p_order_id;

  if v_order is null then
    raise exception 'ไม่พบออเดอร์นี้';
  end if;

  if auth.uid() is null or auth.uid() <> v_order.requester_id then
    raise exception 'ไม่มีสิทธิ์ล็อกเงินของออเดอร์นี้';
  end if;

  if v_order.payment_mode <> 'wallet' then
    raise exception 'ออเดอร์นี้ไม่ใช้ Wallet';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'สถานะออเดอร์ไม่อนุญาตให้ล็อกเงินอีก';
  end if;

  select * into v_wallet from public.wallets where user_id = v_order.requester_id;

  if v_wallet is null then
    raise exception 'ไม่พบกระเป๋าเงินผู้ใช้';
  end if;

  if coalesce(v_wallet.available_balance, 0) + coalesce(v_wallet.frozen_balance, 0) < coalesce(p_total_amount, 0) then
    raise exception 'เงินใน Wallet ไม่พอ';
  end if;

  update public.wallets
    set available_balance = available_balance - p_total_amount,
        frozen_balance = frozen_balance + p_total_amount,
        updated_at = now()
    where id = v_wallet.id;

  insert into public.wallet_transactions (wallet_id, order_id, tx_type, amount, description)
    values (v_wallet.id, p_order_id, 'lock', p_total_amount, 'ล็อกมัดจำ Order #' || p_order_id);

  insert into public.order_status_logs (order_id, changed_by, status, note)
    values (p_order_id, auth.uid(), 'pending', 'ล็อกเงินมัดจำผ่าน Wallet');
end;
$$ language plpgsql security definer;

grant execute on function public.lock_order_escrow(bigint, numeric) to authenticated;

-- RPC: เติม/ถอนเงินจาก Wallet
create or replace function public.process_wallet_transaction(p_mode text, p_amount numeric)
returns void as $$
declare
  v_wallet record;
begin
  if p_mode not in ('topup', 'withdraw') then
    raise exception 'โหมดธุรกรรมไม่ถูกต้อง';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'จำนวนเงินต้องมากกว่า 0';
  end if;

  select * into v_wallet from public.wallets where user_id = auth.uid();

  if v_wallet is null then
    raise exception 'ไม่พบกระเป๋าเงินของผู้ใช้';
  end if;

  if p_mode = 'topup' then
    update public.wallets
      set available_balance = available_balance + p_amount,
          updated_at = now()
      where id = v_wallet.id;

    insert into public.wallet_transactions (wallet_id, tx_type, amount, description)
      values (v_wallet.id, 'topup', p_amount, 'เติมเงินเข้า Wallet');
  else
    if coalesce(v_wallet.available_balance, 0) < p_amount then
      raise exception 'เงินใน Wallet ไม่พอสำหรับการถอน';
    end if;

    update public.wallets
      set available_balance = available_balance - p_amount,
          updated_at = now()
      where id = v_wallet.id;

    insert into public.wallet_transactions (wallet_id, tx_type, amount, description)
      values (v_wallet.id, 'withdraw', p_amount, 'ถอนเงินออกจาก Wallet');
  end if;
end;
$$ language plpgsql security definer;

grant execute on function public.process_wallet_transaction(text, numeric) to authenticated;

-- RPC: ยืนยัน COD และจบงานโดยไม่ต้องผ่าน Escrow
create or replace function public.settle_cod_order(p_order_id bigint, p_changed_by uuid default null)
returns void as $$
declare
  v_order record;
begin
  select * into v_order from public.orders where id = p_order_id;

  if v_order is null then
    raise exception 'ไม่พบออเดอร์นี้';
  end if;

  if auth.uid() is null or (auth.uid() <> v_order.requester_id and auth.uid() <> v_order.runner_id) then
    raise exception 'ไม่มีสิทธิ์ยืนยันออเดอร์นี้';
  end if;

  if v_order.payment_mode <> 'cod' then
    raise exception 'ออเดอร์นี้ไม่ใช่ COD';
  end if;

  if v_order.status <> 'delivering' then
    raise exception 'สถานะออเดอร์ไม่พร้อมยืนยัน COD';
  end if;

  update public.orders
    set status = 'completed', completed_at = now()
    where id = p_order_id;

  insert into public.order_status_logs (order_id, changed_by, status, note)
    values (p_order_id, coalesce(p_changed_by, auth.uid()), 'completed', 'ยืนยันรับเงิน COD');
end;
$$ language plpgsql security definer;

grant execute on function public.settle_cod_order(bigint, uuid) to authenticated;

-- RPC: ปฏิเสธงานและคืนมัดจำให้ผู้ฝากหิ้วทันที (ถ้ามี)
create or replace function public.runner_reject_order(p_order_id bigint, p_runner_id uuid)
returns void as $$
declare
  v_order record;
  v_wallet record;
  v_amount numeric;
begin
  select * into v_order from public.orders where id = p_order_id;

  if v_order is null then
    raise exception 'ไม่พบออเดอร์นี้';
  end if;

  if auth.uid() is null or auth.uid() <> p_runner_id then
    raise exception 'ไม่มีสิทธิ์ปฏิเสธงานนี้';
  end if;

  if coalesce(v_order.runner_id, '')::text <> p_runner_id::text then
    raise exception 'ออเดอร์นี้ไม่ได้ผูกกับ Runner คนนี้';
  end if;

  if v_order.payment_mode = 'wallet' then
    v_amount := coalesce(v_order.item_total, 0) + coalesce(v_order.fee, 0);

    select * into v_wallet from public.wallets where user_id = v_order.requester_id;
    if v_wallet is not null then
      update public.wallets
        set available_balance = available_balance + v_amount,
            frozen_balance = frozen_balance - v_amount,
            updated_at = now()
        where id = v_wallet.id;

      insert into public.wallet_transactions (wallet_id, order_id, tx_type, amount, description)
        values (v_wallet.id, p_order_id, 'refund', v_amount, 'คืนมัดจำหลัง Runner ปฏิเสธงาน');
    end if;
  end if;

  update public.orders
    set runner_id = null,
        status = 'pending'
    where id = p_order_id;

  insert into public.order_status_logs (order_id, changed_by, status, note)
    values (p_order_id, p_runner_id, 'pending', 'Runner ปฏิเสธงานและคืนมัดจำ');
end;
$$ language plpgsql security definer;

grant execute on function public.runner_reject_order(bigint, uuid) to authenticated;
