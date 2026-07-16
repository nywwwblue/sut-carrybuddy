-- ============================================================
-- SUT CarryBuddy — Migration 3: รองรับปักหมุดเอง/ใช้ตำแหน่งปัจจุบัน,
-- Runner โพสต์บอกสิ่งของที่จะซื้อ, และ Requester โพสต์แบบเปิด (ยังไม่เลือกคนรับ))
-- ============================================================

-- Runner_posts: เพิ่มข้อความบอกสิ่งที่จะซื้อ + รองรับปักหมุดต้นทางเอง (แทน store_id ที่ตายตัว)
alter table runner_posts add column if not exists note text;
alter table runner_posts add column if not exists custom_origin_lat decimal(10, 7);
alter table runner_posts add column if not exists custom_origin_lng decimal(10, 7);
alter table runner_posts add column if not exists custom_origin_label varchar(200);

-- Orders: เพิ่มสถานที่ตรงบนตัว order เอง (จำเป็นสำหรับ "โพสต์แบบเปิด" ที่ยังไม่มี post_id ผูกอยู่)
-- และรองรับปักหมุดปลายทางเอง (แทน dropoff_id ที่ตายตัว)
alter table orders add column if not exists store_id bigint references stores(id);
alter table orders add column if not exists dropoff_id bigint references dropoff_locations(id);
alter table orders add column if not exists custom_dropoff_lat decimal(10, 7);
alter table orders add column if not exists custom_dropoff_lng decimal(10, 7);
alter table orders add column if not exists custom_dropoff_label varchar(200);

-- เพิ่ม index ให้ query "บอร์ดคำขอเปิด" (orders ที่ยังไม่มีคนรับ) เร็วขึ้น
create index if not exists idx_orders_open_requests on orders(runner_id) where runner_id is null;

-- ============================================================
-- RPC: รับงานคำขอเปิดแบบปลอดภัย (กันสองคนกดรับพร้อมกันแล้วชนกัน)
-- ใช้ atomic update WHERE runner_id IS NULL เท่านั้นถึงจะสำเร็จ
-- เรียกจากแอปด้วย: supabase.rpc('claim_open_order', { p_order_id, p_post_id })
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

  return false; -- มีคนรับไปก่อนแล้ว
end;
$$ language plpgsql security definer;

grant execute on function public.claim_open_order(bigint, bigint) to authenticated;

-- policy: Requester สร้างคำขอเปิดได้โดยไม่ต้องมี post_id (insert policy เดิมรองรับอยู่แล้วเพราะเช็คแค่ requester_id)
-- ไม่ต้องเพิ่ม policy ใหม่ตรงนี้ เพราะ policy "Requester สร้างออเดอร์ของตัวเองได้" ที่มีอยู่แล้วครอบคลุมอยู่แล้ว
