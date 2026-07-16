-- ============================================================
-- SUT CarryBuddy — Migration 2: เพิ่ม RLS policies (insert/update),
-- RPC function สำหรับปลดล็อกเงิน escrow อย่างปลอดภัย, และเปิด Realtime
-- ============================================================

-- ตรวจสอบก่อนว่าเปิด RLS ไว้แล้วหรือยัง (ถ้าเปิดแล้วคำสั่งนี้จะไม่มีผลอะไรเพิ่ม ไม่ error)
alter table users enable row level security;
alter table wallets enable row level security;
alter table orders enable row level security;
alter table chat_messages enable row level security;

-- INSERT/UPDATE policies ที่ขาดไปตอนรอบแรก (ถ้าไม่มีตรงนี้ RLS จะบล็อกทุก insert/update แม้แต่ของเจ้าของเอง)
drop policy if exists "Requester สร้างออเดอร์ของตัวเองได้" on orders;
create policy "Requester สร้างออเดอร์ของตัวเองได้" on orders for insert with check (auth.uid() = requester_id);

drop policy if exists "คู่สนทนาในออเดอร์แก้ไขออเดอร์ได้" on orders;
create policy "คู่สนทนาในออเดอร์แก้ไขออเดอร์ได้" on orders for update using (auth.uid() = requester_id or auth.uid() = runner_id);

drop policy if exists "ผู้ใช้ส่งข้อความแชทของตัวเองได้" on chat_messages;
create policy "ผู้ใช้ส่งข้อความแชทของตัวเองได้" on chat_messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from orders o where o.id = chat_messages.order_id
    and (o.requester_id = auth.uid() or o.runner_id = auth.uid())
  )
);

drop policy if exists "คู่สนทนามาร์คข้อความว่าอ่านแล้วได้" on chat_messages;
create policy "คู่สนทนามาร์คข้อความว่าอ่านแล้วได้" on chat_messages for update using (
  exists (
    select 1 from orders o where o.id = chat_messages.order_id
    and (o.requester_id = auth.uid() or o.runner_id = auth.uid())
  )
);

drop policy if exists "ผู้ใช้แก้ไขกระเป๋าเงินตัวเองได้" on wallets;
create policy "ผู้ใช้แก้ไขกระเป๋าเงินตัวเองได้" on wallets for update using (auth.uid() = user_id);

-- ============================================================
-- RPC: ปลดล็อกเงิน escrow ให้ Runner + จบงาน อย่างปลอดภัย
-- (create or replace ปลอดภัยอยู่แล้ว รันซ้ำได้ไม่พัง)
-- ============================================================
create or replace function public.release_escrow_and_complete(p_order_id bigint)
returns void as $$
declare
  v_order record;
  v_wallet record;
begin
  select * into v_order from orders where id = p_order_id;

  if v_order is null then
    raise exception 'ไม่พบออเดอร์นี้';
  end if;

  if auth.uid() != v_order.requester_id and auth.uid() != v_order.runner_id then
    raise exception 'ไม่มีสิทธิ์ยืนยันออเดอร์นี้';
  end if;

  if v_order.status = 'completed' then
    return;
  end if;

  if v_order.payment_mode = 'wallet' then
    select * into v_wallet from wallets where user_id = v_order.runner_id;
    update wallets set available_balance = available_balance + v_order.fee where id = v_wallet.id;
    insert into wallet_transactions (wallet_id, order_id, tx_type, amount, description)
      values (v_wallet.id, p_order_id, 'earn', v_order.fee, 'รายได้ค่าหิ้ว Order #' || p_order_id);

    update wallets set frozen_balance = frozen_balance - (v_order.item_total + v_order.fee)
      where user_id = v_order.requester_id;
  end if;

  update orders set status = 'completed', completed_at = now() where id = p_order_id;
  insert into order_status_logs (order_id, changed_by, status, note)
    values (p_order_id, auth.uid(), 'completed', 'ยืนยันรับสินค้า/ปลดล็อกเงินผ่าน RPC');
end;
$$ language plpgsql security definer;

grant execute on function public.release_escrow_and_complete(bigint) to authenticated;

-- ============================================================
-- Realtime — เปิดใช้งานสำหรับตารางที่แอปฟัง realtime อยู่จริง
-- ใช้ DO block เช็คก่อนว่าตารางอยู่ใน publication แล้วหรือยัง กันชน error ตารางซ้ำ
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'flash_buy_sessions'
  ) then
    alter publication supabase_realtime add table flash_buy_sessions;
  end if;
end $$;
