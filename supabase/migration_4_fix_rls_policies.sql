-- ============================================================
-- SUT CarryBuddy — Migration 4: แก้ RLS ที่บล็อก insert บนตาราง
-- runner_posts / reviews / order_items / wallet_transactions / order_status_logs / flash_buy_sessions
-- ============================================================

alter table runner_posts enable row level security;
alter table reviews enable row level security;
alter table order_items enable row level security;
alter table wallet_transactions enable row level security;
alter table order_status_logs enable row level security;
alter table flash_buy_sessions enable row level security;
alter table trust_scores enable row level security;

-- runner_posts: ทุกคนดูโพสต์เปิดได้ (ต้องเห็นในหน้า Home/บอร์ด), แต่แก้ไข/สร้างได้เฉพาะเจ้าของโพสต์
drop policy if exists "ทุกคนเห็นโพสต์รับหิ้วได้" on runner_posts;
create policy "ทุกคนเห็นโพสต์รับหิ้วได้" on runner_posts for select using (true);

drop policy if exists "Runner สร้างโพสต์ของตัวเองได้" on runner_posts;
create policy "Runner สร้างโพสต์ของตัวเองได้" on runner_posts for insert with check (auth.uid() = runner_id);

drop policy if exists "Runner แก้ไขโพสต์ของตัวเองได้" on runner_posts;
create policy "Runner แก้ไขโพสต์ของตัวเองได้" on runner_posts for update using (auth.uid() = runner_id);

-- reviews: ดูได้ทุกคน (ใช้โชว์ในหน้า rider-details), สร้างได้เฉพาะคนที่เป็น requester ของออเดอร์นั้นจริง
drop policy if exists "ทุกคนเห็นรีวิวได้" on reviews;
create policy "ทุกคนเห็นรีวิวได้" on reviews for select using (true);

drop policy if exists "Requester รีวิวออเดอร์ของตัวเองได้" on reviews;
create policy "Requester รีวิวออเดอร์ของตัวเองได้" on reviews for insert with check (
  auth.uid() = reviewer_id and exists (
    select 1 from orders o where o.id = reviews.order_id and o.requester_id = auth.uid()
  )
);

-- order_items: เห็น/แก้ไขได้เฉพาะคนที่เกี่ยวข้องกับออเดอร์นั้น (requester หรือ runner)
drop policy if exists "คู่ออเดอร์เห็นรายการสินค้าได้" on order_items;
create policy "คู่ออเดอร์เห็นรายการสินค้าได้" on order_items for select using (
  exists (select 1 from orders o where o.id = order_items.order_id and (o.requester_id = auth.uid() or o.runner_id = auth.uid()))
);

drop policy if exists "Requester เพิ่มรายการสินค้าในออเดอร์ตัวเองได้" on order_items;
create policy "Requester เพิ่มรายการสินค้าในออเดอร์ตัวเองได้" on order_items for insert with check (
  exists (select 1 from orders o where o.id = order_items.order_id and o.requester_id = auth.uid())
);

drop policy if exists "Runner ติ๊กหยิบของในออเดอร์ตัวเองได้" on order_items;
create policy "Runner ติ๊กหยิบของในออเดอร์ตัวเองได้" on order_items for update using (
  exists (select 1 from orders o where o.id = order_items.order_id and (o.requester_id = auth.uid() or o.runner_id = auth.uid()))
);

-- wallet_transactions: เห็น/สร้างได้เฉพาะรายการของกระเป๋าตัวเอง
drop policy if exists "เห็นธุรกรรมกระเป๋าตัวเองเท่านั้น" on wallet_transactions;
create policy "เห็นธุรกรรมกระเป๋าตัวเองเท่านั้น" on wallet_transactions for select using (
  exists (select 1 from wallets w where w.id = wallet_transactions.wallet_id and w.user_id = auth.uid())
);

drop policy if exists "สร้างธุรกรรมกระเป๋าตัวเองเท่านั้น" on wallet_transactions;
create policy "สร้างธุรกรรมกระเป๋าตัวเองเท่านั้น" on wallet_transactions for insert with check (
  exists (select 1 from wallets w where w.id = wallet_transactions.wallet_id and w.user_id = auth.uid())
);

-- order_status_logs: เห็น/สร้างได้เฉพาะคู่ออเดอร์
drop policy if exists "คู่ออเดอร์เห็นประวัติสถานะได้" on order_status_logs;
create policy "คู่ออเดอร์เห็นประวัติสถานะได้" on order_status_logs for select using (
  exists (select 1 from orders o where o.id = order_status_logs.order_id and (o.requester_id = auth.uid() or o.runner_id = auth.uid()))
);

drop policy if exists "คู่ออเดอร์บันทึกประวัติสถานะได้" on order_status_logs;
create policy "คู่ออเดอร์บันทึกประวัติสถานะได้" on order_status_logs for insert with check (
  exists (select 1 from orders o where o.id = order_status_logs.order_id and (o.requester_id = auth.uid() or o.runner_id = auth.uid()))
);

-- flash_buy_sessions: ทุกคนเห็นได้ (ใช้โชว์ banner หน้า Home), สร้าง/แก้ไขได้เฉพาะเจ้าของ
drop policy if exists "ทุกคนเห็นบอร์ด Flash Buy ได้" on flash_buy_sessions;
create policy "ทุกคนเห็นบอร์ด Flash Buy ได้" on flash_buy_sessions for select using (true);

drop policy if exists "Runner เปิดบอร์ดของตัวเองได้" on flash_buy_sessions;
create policy "Runner เปิดบอร์ดของตัวเองได้" on flash_buy_sessions for insert with check (auth.uid() = runner_id);

drop policy if exists "Runner ปิดบอร์ดของตัวเองได้" on flash_buy_sessions;
create policy "Runner ปิดบอร์ดของตัวเองได้" on flash_buy_sessions for update using (auth.uid() = runner_id);

-- trust_scores: ทุกคนดูได้ (โชว์ trust badge ทุกที่), ห้ามแก้ไขตรงจาก client เด็ดขาด
-- (แก้ผ่าน RPC submit_review เท่านั้น เพื่อกันไม่ให้ใครก็ได้เขียนทับคะแนนคนอื่นตรงๆ)
drop policy if exists "ทุกคนเห็น Trust Score ได้" on trust_scores;
create policy "ทุกคนเห็น Trust Score ได้" on trust_scores for select using (true);

-- ============================================================
-- RPC: ส่งรีวิว + ปรับ Trust Score อย่างปลอดภัยในทีเดียว
-- (เดิม rate-rider.tsx เขียนตรงไปที่ trust_scores ของ "อีกคน" จาก client
--  ซึ่งจะโดน RLS บล็อกเช่นกัน และไม่ปลอดภัยอยู่ดีแม้ไม่มี RLS)
-- เรียกจากแอปด้วย: supabase.rpc('submit_review', { p_order_id, p_runner_id, p_rating, p_comment })
-- ============================================================
create or replace function public.submit_review_and_update_trust(
  p_order_id bigint,
  p_runner_id uuid,
  p_rating int,
  p_comment text default null
)
returns void as $$
declare
  v_trust record;
  v_delta int;
  v_new_score int;
begin
  if not exists (select 1 from orders where id = p_order_id and requester_id = auth.uid()) then
    raise exception 'คุณไม่มีสิทธิ์รีวิวออเดอร์นี้';
  end if;

  insert into reviews (order_id, reviewer_id, runner_id, rating_stars, comment)
    values (p_order_id, auth.uid(), p_runner_id, p_rating, p_comment);

  select * into v_trust from trust_scores where user_id = p_runner_id;
  v_delta := (p_rating - 3) * 2;
  v_new_score := greatest(0, least(100, v_trust.trust_score + v_delta));

  update trust_scores set trust_score = v_new_score where user_id = p_runner_id;

  insert into trust_score_logs (user_id, order_id, reason, delta, new_score)
    values (p_runner_id, p_order_id, 'ได้รับรีวิว ' || p_rating || ' ดาว', v_delta, v_new_score);
end;
$$ language plpgsql security definer;

grant execute on function public.submit_review_and_update_trust(bigint, uuid, int, text) to authenticated;
