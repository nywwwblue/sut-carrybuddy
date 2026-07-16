<<<<<<< HEAD
🚀 SUT FindBack & Logistics Platform
ระบบแอปพลิเคชันสำหรับไรเดอร์ มทส. (SUT Runner) ที่ช่วยจัดการงานรับหิ้วแบบครบวงจร รองรับทั้งการประกาศงานปกติ, การเปิดบอร์ดรับงานด่วน (Flash Buy), และการบริหารจัดการงานพ่วง (Route Pooling) เพื่อเพิ่มประสิทธิภาพในการทำงานของไรเดอร์

🛠️ Tech Stack
Framework: Expo Router (React Native)

Backend/Database: Supabase

Styling: StyleSheet (Native)

Realtime: Supabase Realtime

📂 Project Structure
โปรเจกต์ถูกจัดกลุ่มตามฟีเจอร์การใช้งานเพื่อความเป็นระเบียบ:

(auth)/: ระบบลงทะเบียนและเข้าสู่ระบบ

(runner-tabs)/: หน้าหลักและเครื่องมือจัดการงานสำหรับไรเดอร์

(tabs)/: หน้าหลักสำหรับผู้ใช้ทั่วไป (Buyer)

(orders)/: จัดการรายละเอียดคำสั่งซื้อและรายการสินค้า

(flash)/: ระบบบอร์ดรับงานด่วน (Flash Buy)

(payment)/: ระบบจัดการกระเป๋าเงินและการชำระเงิน

⚡ Key Features
Flash Buy System: เปิดบอร์ดรับออเดอร์หน้าเซเว่น/ร้านค้า มทส. แบบเรียลไทม์ (จำกัดเวลา 5 นาที)

Realtime Updates: ใช้ Supabase Realtime เพื่ออัปเดตยอดคำสั่งซื้อสดๆ บนหน้าจอมือถือ

Route Pooling: รวมงานตามปลายทางเพื่อการเดินหิ้วที่คุ้มค่าที่สุด

Price Validation: ระบบตรวจสอบราคาจริงและอัปโหลดหลักฐานผ่านฐานข้อมูล

🚀 How to Run
ติดตั้ง Dependencies:

Bash
npm install
ตั้งค่า Environment Variables (.env) โดยระบุ SUPABASE_URL และ SUPABASE_ANON_KEY

รันโปรเจกต์:

Bash
npx expo start
🔐 Security & Safety
ใช้ Row Level Security (RLS) ของ Supabase เพื่อป้องกันการเข้าถึงข้อมูลที่ไม่ได้รับอนุญาต

มีระบบตรวจสอบราคาประเมิน (Buffer 20%) เพื่อป้องกันการโกงราคาจากไรเดอร์
=======
# sut-carrybuddy
>>>>>>> f5e9653fcf332b62288b3046908acc2da97fe5c5
