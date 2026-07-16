-- ============================================================
-- SUT CarryBuddy — Database Schema (PostgreSQL / Supabase)
-- ============================================================

-- หมวดที่ 9: พิกัดภูมิศาสตร์ (สร้างก่อนเพราะตารางอื่นอ้างอิงถึง)
-- ------------------------------------------------------------
create table if not exists stores (
  id            bigserial primary key,
  name          varchar(150) not null,
  location_name varchar(200),
  lat           decimal(10, 7),
  lng           decimal(10, 7),
  is_preset     boolean default false,
  created_at    timestamptz default now()
);

create table if not exists dropoff_locations (
  id         bigserial primary key,
  name       varchar(150) not null,
  zone       varchar(100),
  lat        decimal(10, 7),
  lng        decimal(10, 7),
  is_active  boolean default true,
  created_at timestamptz default now()
);

-- หมวดที่ 1: ผู้ใช้งานและความน่าเชื่อถือ
-- ------------------------------------------------------------
-- ใช้ id เดียวกับ Supabase Auth (auth.users.id เป็น uuid) เพื่อผูก Auth เข้ากับโปรไฟล์โดยตรง
create table if not exists users (
  id             uuid primary key references auth.users(id) on delete cascade,
  student_id     varchar(20),
  name           varchar(150) not null,
  email          varchar(150) unique not null,
  phone          varchar(20),
  department     varchar(150),
  avatar_url     varchar(300),
  role           varchar(20) not null default 'requester'
                 check (role in ('requester', 'runner', 'admin')),
  created_at     timestamptz default now()
);
-- หมายเหตุ: ไม่ต้องมี password_hash เพราะ Supabase Auth จัดการรหัสผ่านให้ในตัวอยู่แล้ว (auth.users)

create table if not exists trust_scores (
  id                   bigserial primary key,
  user_id              uuid not null references users(id) on delete cascade,
  trust_score          int default 100,
  punctuality_rate     int default 100,
  effort_rate          int default 100,
  responsibility_rate  int default 100,
  total_carries        int default 0,
  total_orders         int default 0,
  unique (user_id)
);

-- หมวดที่ 2: ประกาศรับหิ้ว
-- ------------------------------------------------------------
create table if not exists runner_posts (
  id             bigserial primary key,
  runner_id      uuid not null references users(id) on delete cascade,
  store_id       bigint references stores(id),
  dropoff_id     bigint references dropoff_locations(id),
  post_type      varchar(10) not null default 'normal' check (post_type in ('normal', 'flash')),
  vehicle_type   varchar(10) check (vehicle_type in ('walk', 'bike', 'moto', 'car')),
  max_orders     int default 1,
  fee_per_order  decimal(10, 2) not null default 0,
  available_at   time,
  status         varchar(15) not null default 'open'
                 check (status in ('open', 'in_progress', 'closed')),
  note                 text, -- Runner บอกสิ่งที่จะไปซื้อ/ข้อความชวนคนสั่ง
  custom_origin_lat    decimal(10, 7), -- ใช้เมื่อปักหมุดต้นทางเอง (แทน store_id)
  custom_origin_lng    decimal(10, 7),
  custom_origin_label  varchar(200),
  created_at     timestamptz default now()
);

-- หมวดที่ 6: Flash Buy และ Route Pooling
-- ------------------------------------------------------------
create table if not exists flash_buy_sessions (
  id               bigserial primary key,
  runner_id        uuid not null references users(id) on delete cascade,
  store_id         bigint references stores(id),
  duration_seconds int default 300,
  status           varchar(10) not null default 'active'
                   check (status in ('active', 'closed', 'expired')),
  started_at       timestamptz default now(),
  closed_at        timestamptz
);

create table if not exists bundle_groups (
  id          bigserial primary key,
  store_id    bigint references stores(id),
  dropoff_id  bigint references dropoff_locations(id),
  order_count int default 0,
  total_fee   decimal(10, 2) default 0,
  created_at  timestamptz default now()
);

-- หมวดที่ 3: ออเดอร์และรายการสินค้า
-- ------------------------------------------------------------
create table if not exists orders (
  id             bigserial primary key,
  post_id        bigint references runner_posts(id),
  requester_id   uuid not null references users(id),
  runner_id      uuid references users(id),
  bundle_group_id bigint references bundle_groups(id),
  payment_mode   varchar(10) not null check (payment_mode in ('wallet', 'cod')),
  item_total     decimal(10, 2) default 0,
  fee            decimal(10, 2) default 0,
  status         varchar(15) not null default 'pending'
                 check (status in ('pending','accepted','buying','bought','delivering','completed','cancelled')),
  store_id             bigint references stores(id), -- ใช้ตอนโพสต์แบบเปิดที่ยังไม่มี post_id
  dropoff_id           bigint references dropoff_locations(id),
  custom_dropoff_lat   decimal(10, 7), -- ใช้เมื่อปักหมุดปลายทางเอง (แทน dropoff_id)
  custom_dropoff_lng   decimal(10, 7),
  custom_dropoff_label varchar(200),
  created_at     timestamptz default now(),
  completed_at   timestamptz
);

create table if not exists order_items (
  id         bigserial primary key,
  order_id   bigint not null references orders(id) on delete cascade,
  item_name  varchar(200) not null,
  quantity   int default 1,
  est_price  decimal(10, 2),
  is_bought  boolean default false,
  note       text,
  image_url  varchar(300)
);

-- หมวดที่ 4: การเงินและแชท
-- ------------------------------------------------------------
create table if not exists wallets (
  id                bigserial primary key,
  user_id           uuid not null references users(id) on delete cascade,
  available_balance decimal(10, 2) default 0,
  frozen_balance    decimal(10, 2) default 0,
  updated_at        timestamptz default now(),
  unique (user_id)
);

create table if not exists wallet_transactions (
  id          bigserial primary key,
  wallet_id   bigint not null references wallets(id) on delete cascade,
  order_id    bigint references orders(id),
  tx_type     varchar(10) not null
              check (tx_type in ('lock','unlock','earn','refund','topup','withdraw')),
  amount      decimal(10, 2) not null,
  description varchar(300),
  created_at  timestamptz default now()
);

create table if not exists chat_messages (
  id         bigserial primary key,
  order_id   bigint not null references orders(id) on delete cascade,
  sender_id  uuid not null references users(id),
  content    text,
  image_url  varchar(300),
  msg_type   varchar(10) default 'text' check (msg_type in ('text', 'image', 'system')),
  is_read    boolean default false,
  created_at timestamptz default now()
);

-- หมวดที่ 5: รีวิว
-- ------------------------------------------------------------
create table if not exists reviews (
  id            bigserial primary key,
  order_id      bigint not null unique references orders(id) on delete cascade,
  reviewer_id   uuid not null references users(id),
  runner_id     uuid not null references users(id),
  rating_stars  int not null check (rating_stars between 1 and 5),
  comment       text,
  created_at    timestamptz default now()
);

-- หมวดที่ 7: ไทม์ไลน์และหลักฐาน
-- ------------------------------------------------------------
create table if not exists order_status_logs (
  id         bigserial primary key,
  order_id   bigint not null references orders(id) on delete cascade,
  changed_by uuid references users(id),
  status     varchar(15) not null,
  note       varchar(300),
  changed_at timestamptz default now()
);

create table if not exists proof_of_purchases (
  id            bigserial primary key,
  order_id      bigint not null references orders(id) on delete cascade,
  image_url     varchar(300) not null,
  verify_status varchar(10) default 'pending' check (verify_status in ('pending','approved','rejected')),
  uploaded_at   timestamptz default now(),
  verified_at   timestamptz
);

-- หมวดที่ 8: ความน่าเชื่อถือและข้อพิพาท
-- ------------------------------------------------------------
create table if not exists trust_score_logs (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  order_id   bigint references orders(id),
  reason     varchar(300),
  delta      int not null,
  new_score  int not null,
  created_at timestamptz default now()
);

create table if not exists dispute_reports (
  id         bigserial primary key,
  filed_by   uuid not null references users(id),
  order_id   bigint not null references orders(id),
  reason     text,
  status     varchar(10) default 'pending' check (status in ('pending','reviewed','resolved')),
  admin_note text,
  created_at timestamptz default now()
);

-- ============================================================
-- Indexes ที่ควรมีเพื่อความเร็วของ query ที่ใช้บ่อย
-- ============================================================
create index if not exists idx_orders_requester on orders(requester_id);
create index if not exists idx_orders_runner on orders(runner_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_runner_posts_status on runner_posts(status);
create index if not exists idx_chat_messages_order on chat_messages(order_id);
create index if not exists idx_wallet_tx_wallet on wallet_transactions(wallet_id);

-- ============================================================
-- Trigger: สร้างแถวใน users + wallets อัตโนมัติเมื่อมีการสมัครสมาชิกใหม่ผ่าน Supabase Auth
-- และบังคับโดเมนอีเมล @g.sut.ac.th / @sut.ac.th ตั้งแต่ตอนสมัคร
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  if new.email !~ '@(g\.)?sut\.ac\.th$' then
    raise exception 'ต้องใช้อีเมลสถาบัน (@g.sut.ac.th หรือ @sut.ac.th) เท่านั้น';
  end if;

  insert into public.users (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));

  insert into public.trust_scores (user_id) values (new.id);
  insert into public.wallets (user_id) values (new.id);

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security (RLS) — เปิดใช้งานเพื่อความปลอดภัยของข้อมูล
-- (ตัวอย่างพื้นฐาน แนะนำให้ปรับ policy ให้ละเอียดขึ้นตามการใช้งานจริง)
-- ============================================================
alter table users enable row level security;
alter table wallets enable row level security;
alter table orders enable row level security;
alter table chat_messages enable row level security;

drop policy if exists "ผู้ใช้เห็นโปรไฟล์ตัวเองและคนอื่นได้ (อ่านอย่างเดียว)" on users;
create policy "ผู้ใช้เห็นโปรไฟล์ตัวเองและคนอื่นได้ (อ่านอย่างเดียว)"
  on users for select using (true);

drop policy if exists "ผู้ใช้แก้ไขได้เฉพาะโปรไฟล์ตัวเอง" on users;
create policy "ผู้ใช้แก้ไขได้เฉพาะโปรไฟล์ตัวเอง"
  on users for update using (auth.uid() = id);

drop policy if exists "ผู้ใช้เห็นกระเป๋าเงินตัวเองเท่านั้น" on wallets;
create policy "ผู้ใช้เห็นกระเป๋าเงินตัวเองเท่านั้น"
  on wallets for select using (auth.uid() = user_id);

drop policy if exists "ผู้ใช้เห็นออเดอร์ที่ตัวเองเกี่ยวข้อง" on orders;
create policy "ผู้ใช้เห็นออเดอร์ที่ตัวเองเกี่ยวข้อง"
  on orders for select using (auth.uid() = requester_id or auth.uid() = runner_id);

drop policy if exists "ผู้ใช้เห็นแชทเฉพาะออเดอร์ของตัวเอง" on chat_messages;
create policy "ผู้ใช้เห็นแชทเฉพาะออเดอร์ของตัวเอง"
  on chat_messages for select using (
    exists (
      select 1 from orders o
      where o.id = chat_messages.order_id
      and (o.requester_id = auth.uid() or o.runner_id = auth.uid())
    )
  );

-- INSERT/UPDATE policies (สำคัญมาก — ถ้าไม่มีตรงนี้ RLS จะบล็อกทุก insert/update แม้แต่ของเจ้าของเอง)
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
-- ทำเป็นฟังก์ชันฝั่งฐานข้อมูล (SECURITY DEFINER) แทนการให้ฝั่งแอปแก้ยอดเงินของอีกฝ่ายตรงๆ
-- เพราะ RLS ปกติจะไม่ยอมให้ user คนหนึ่งเขียนทับ wallet ของอีกคนได้ (และไม่ควรอนุญาตด้วย)
-- เรียกใช้จากแอปด้วย: supabase.rpc('release_escrow_and_complete', { p_order_id: orderId })
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
    return; -- ทำไปแล้ว ไม่ต้องทำซ้ำ
  end if;

  if v_order.payment_mode = 'wallet' then
    select * into v_wallet from wallets where user_id = v_order.runner_id;
    update wallets set available_balance = available_balance + v_order.fee where id = v_wallet.id;
    insert into wallet_transactions (wallet_id, order_id, tx_type, amount, description)
      values (v_wallet.id, p_order_id, 'earn', v_order.fee, 'รายได้ค่าหิ้ว Order #' || p_order_id);

    -- ปลดล็อกฝั่งผู้ฝาก (เอาเงินออกจาก frozen_balance เพราะจ่ายให้ Runner แล้ว)
    update wallets set frozen_balance = frozen_balance - (v_order.item_total + v_order.fee)
      where user_id = v_order.requester_id;
  end if;

  update orders set status = 'completed', completed_at = now() where id = p_order_id;
  insert into order_status_logs (order_id, changed_by, status, note)
    values (p_order_id, auth.uid(), 'completed', 'ยืนยันรับสินค้า/ปลดล็อกเงินผ่าน RPC');
end;
$$ language plpgsql security definer;

grant execute on function public.release_escrow_and_complete(bigint) to authenticated;

-- index สำหรับ query "บอร์ดคำขอเปิด" (orders ที่ยังไม่มีคนรับ)
create index if not exists idx_orders_open_requests on orders(runner_id) where runner_id is null;

-- ============================================================
-- RPC: รับงานคำขอเปิดแบบปลอดภัย (กันสองคนกดรับพร้อมกันแล้วชนกัน)
-- ============================================================
create or replace function public.claim_open_order(p_order_id bigint, p_post_id bigint default null)
returns boolean as $$
declare
  v_updated int;
begin
  update orders
    set runner_id = auth.uid(),
        post_id = coalesce(p_post_id, post_id),
        status = 'accepted'
    where id = p_order_id and runner_id is null;

  get diagnostics v_updated = row_count;

  if v_updated > 0 then
    insert into order_status_logs (order_id, changed_by, status, note)
      values (p_order_id, auth.uid(), 'accepted', 'Runner รับงานจากบอร์ดคำขอเปิด');
    return true;
  end if;

  return false;
end;
$$ language plpgsql security definer;

grant execute on function public.claim_open_order(bigint, bigint) to authenticated;

-- ============================================================
-- RLS policies เพิ่มเติมสำหรับตารางที่เหลือ (migration_4)
-- ============================================================
-- เปิด RLS ให้ครบทุกตาราง (คำสั่งนี้รันซ้ำได้ไม่พัง ถ้าเปิดอยู่แล้วจะไม่มีผลอะไรเพิ่ม)
alter table runner_posts enable row level security;
alter table order_items enable row level security;
alter table reviews enable row level security;
alter table wallet_transactions enable row level security;
alter table order_status_logs enable row level security;
alter table flash_buy_sessions enable row level security;
alter table bundle_groups enable row level security;
alter table trust_scores enable row level security;
alter table stores enable row level security;
alter table dropoff_locations enable row level security;
alter table proof_of_purchases enable row level security;
alter table trust_score_logs enable row level security;
alter table dispute_reports enable row level security;

-- ---------- stores / dropoff_locations: ทุกคนอ่านได้ (preset สาธารณะ) ----------
drop policy if exists "ทุกคนอ่านรายชื่อร้านค้าได้" on stores;
create policy "ทุกคนอ่านรายชื่อร้านค้าได้" on stores for select using (true);

drop policy if exists "ทุกคนอ่านจุดดรอปได้" on dropoff_locations;
create policy "ทุกคนอ่านจุดดรอปได้" on dropoff_locations for select using (true);

-- ---------- runner_posts: อ่านได้ทุกคน, สร้าง/แก้ไขได้เฉพาะเจ้าของโพสต์ ----------
drop policy if exists "ทุกคนเห็นโพสต์รับหิ้วได้" on runner_posts;
create policy "ทุกคนเห็นโพสต์รับหิ้วได้" on runner_posts for select using (true);

drop policy if exists "Runner สร้างโพสต์ของตัวเองได้" on runner_posts;
create policy "Runner สร้างโพสต์ของตัวเองได้" on runner_posts for insert with check (auth.uid() = runner_id);

drop policy if exists "Runner แก้ไขโพสต์ของตัวเองได้" on runner_posts;
create policy "Runner แก้ไขโพสต์ของตัวเองได้" on runner_posts for update using (auth.uid() = runner_id);

-- ---------- trust_scores: อ่านได้ทุกคน (โชว์ trust score ต้องเห็นของคนอื่น), แก้ไขผ่าน RPC เท่านั้น ----------
drop policy if exists "ทุกคนอ่าน trust score ได้" on trust_scores;
create policy "ทุกคนอ่าน trust score ได้" on trust_scores for select using (true);
-- หมายเหตุ: ไม่เปิด policy update ตรงๆ เพราะเป็นการแก้คะแนนของ "อีกฝ่าย" (cross-user)
-- ต้องผ่านฟังก์ชัน submit_review_and_update_trust() ด้านล่างเท่านั้น (SECURITY DEFINER)

-- ---------- order_items: ผูกกับ order เดียวกับที่ user มีสิทธิ์ ----------
drop policy if exists "เห็น item ของออเดอร์ตัวเองได้" on order_items;
create policy "เห็น item ของออเดอร์ตัวเองได้" on order_items for select using (
  exists (select 1 from orders o where o.id = order_items.order_id
    and (o.requester_id = auth.uid() or o.runner_id = auth.uid()))
);
drop policy if exists "สร้าง item ในออเดอร์ตัวเองได้" on order_items;
create policy "สร้าง item ในออเดอร์ตัวเองได้" on order_items for insert with check (
  exists (select 1 from orders o where o.id = order_items.order_id and o.requester_id = auth.uid())
);
drop policy if exists "อัปเดต item (ติ๊กหยิบแล้ว) ในออเดอร์ตัวเองได้" on order_items;
create policy "อัปเดต item (ติ๊กหยิบแล้ว) ในออเดอร์ตัวเองได้" on order_items for update using (
  exists (select 1 from orders o where o.id = order_items.order_id
    and (o.requester_id = auth.uid() or o.runner_id = auth.uid()))
);

-- ---------- reviews: เห็นได้ทุกคน (โชว์รีวิวใน rider-details), สร้างได้เฉพาะคนรีวิวเอง ----------
drop policy if exists "ทุกคนอ่านรีวิวได้" on reviews;
create policy "ทุกคนอ่านรีวิวได้" on reviews for select using (true);
drop policy if exists "ผู้ใช้ส่งรีวิวของตัวเองได้" on reviews;
create policy "ผู้ใช้ส่งรีวิวของตัวเองได้" on reviews for insert with check (auth.uid() = reviewer_id);

-- ---------- wallet_transactions: เห็น/สร้างได้เฉพาะ transaction ของกระเป๋าตัวเอง ----------
drop policy if exists "เห็นธุรกรรมกระเป๋าตัวเองได้" on wallet_transactions;
create policy "เห็นธุรกรรมกระเป๋าตัวเองได้" on wallet_transactions for select using (
  exists (select 1 from wallets w where w.id = wallet_transactions.wallet_id and w.user_id = auth.uid())
);
drop policy if exists "สร้างธุรกรรมกระเป๋าตัวเองได้" on wallet_transactions;
create policy "สร้างธุรกรรมกระเป๋าตัวเองได้" on wallet_transactions for insert with check (
  exists (select 1 from wallets w where w.id = wallet_transactions.wallet_id and w.user_id = auth.uid())
);

-- ---------- order_status_logs: อ่าน/สร้างได้เฉพาะออเดอร์ที่เกี่ยวข้อง ----------
drop policy if exists "เห็น log ออเดอร์ตัวเองได้" on order_status_logs;
create policy "เห็น log ออเดอร์ตัวเองได้" on order_status_logs for select using (
  exists (select 1 from orders o where o.id = order_status_logs.order_id
    and (o.requester_id = auth.uid() or o.runner_id = auth.uid()))
);
drop policy if exists "สร้าง log ออเดอร์ตัวเองได้" on order_status_logs;
create policy "สร้าง log ออเดอร์ตัวเองได้" on order_status_logs for insert with check (
  exists (select 1 from orders o where o.id = order_status_logs.order_id
    and (o.requester_id = auth.uid() or o.runner_id = auth.uid()))
);

-- ---------- flash_buy_sessions: อ่านได้ทุกคน (โชว์ banner), สร้าง/แก้ไขได้เฉพาะเจ้าของ ----------
drop policy if exists "ทุกคนเห็นบอร์ด Flash Buy ได้" on flash_buy_sessions;
create policy "ทุกคนเห็นบอร์ด Flash Buy ได้" on flash_buy_sessions for select using (true);
drop policy if exists "Runner เปิดบอร์ดของตัวเองได้" on flash_buy_sessions;
create policy "Runner เปิดบอร์ดของตัวเองได้" on flash_buy_sessions for insert with check (auth.uid() = runner_id);
drop policy if exists "Runner แก้ไขบอร์ดของตัวเองได้" on flash_buy_sessions;
create policy "Runner แก้ไขบอร์ดของตัวเองได้" on flash_buy_sessions for update using (auth.uid() = runner_id);

-- ---------- bundle_groups: อ่านได้ทุกคน (ยังไม่มี insert ฝั่งแอปตอนนี้) ----------
drop policy if exists "ทุกคนเห็น bundle group ได้" on bundle_groups;
create policy "ทุกคนเห็น bundle group ได้" on bundle_groups for select using (true);

-- ============================================================
-- RPC: ส่งรีวิว + ปรับ Trust Score ของ Runner พร้อมกันอย่างปลอดภัย
-- (เดิมแอปเขียนอัปเดต trust_scores ของ "อีกฝ่าย" ตรงๆ จาก client ซึ่ง RLS ไม่ควรอนุญาต
--  ต้องทำเป็น RPC แบบเดียวกับ release_escrow_and_complete)
-- เรียกจากแอปด้วย: supabase.rpc('submit_review_and_update_trust', { p_order_id, p_runner_id, p_rating, p_comment })
-- ============================================================
create or replace function public.submit_review_and_update_trust(
  p_order_id bigint, p_runner_id uuid, p_rating int, p_comment text default null
)
returns void as $$
declare
  v_delta int;
  v_new_score int;
begin
  insert into reviews (order_id, reviewer_id, runner_id, rating_stars, comment)
    values (p_order_id, auth.uid(), p_runner_id, p_rating, p_comment);

  v_delta := (p_rating - 3) * 2;

  update trust_scores
    set trust_score = greatest(0, least(100, trust_score + v_delta))
    where user_id = p_runner_id
    returning trust_score into v_new_score;

  insert into trust_score_logs (user_id, order_id, reason, delta, new_score)
    values (p_runner_id, p_order_id, 'ได้รับรีวิว ' || p_rating || ' ดาว', v_delta, coalesce(v_new_score, 100));
end;
$$ language plpgsql security definer;

grant execute on function public.submit_review_and_update_trust(bigint, uuid, int, text) to authenticated;


-- ============================================================
-- Realtime — เปิดใช้งานสำหรับตารางที่แอปฟัง realtime อยู่จริง
-- (Chat แบบเรียลไทม์, Flash Buy live orders, banner แจ้งเตือนบอร์ดด่วน)
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table chat_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
    alter publication supabase_realtime add table orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'flash_buy_sessions') then
    alter publication supabase_realtime add table flash_buy_sessions;
  end if;
end $$;
