-- ============================================================
-- SUT CarryBuddy — Migration 4: แก้ RLS policy ที่ขาดไปเกือบทุกตาราง
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
