import React from 'react';
import InfoScreen, { InfoHeading, InfoParagraph, InfoBullet } from '@/components/InfoScreen';

export default function PrivacyPolicyScreen() {
  return (
    <InfoScreen title="นโยบายความเป็นส่วนตัว">
      <InfoParagraph>
        SUT CarryBuddy ให้ความสำคัญกับความเป็นส่วนตัวของผู้ใช้งานทุกคน
        นโยบายฉบับนี้อธิบายว่าเราเก็บ ใช้ และดูแลข้อมูลของท่านอย่างไร
      </InfoParagraph>

      <InfoHeading>1. ข้อมูลที่เราเก็บรวบรวม</InfoHeading>
      <InfoBullet>ข้อมูลบัญชี เช่น ชื่อ อีเมลมหาวิทยาลัย สาขาวิชา และรูปโปรไฟล์</InfoBullet>
      <InfoBullet>ข้อมูลตำแหน่งที่ตั้ง เพื่อจับคู่เส้นทางการฝากหิ้วและติดตามสถานะการจัดส่ง</InfoBullet>
      <InfoBullet>ประวัติการทำรายการ การสนทนาในแชท และคะแนนรีวิว</InfoBullet>
      <InfoBullet>ข้อมูลการชำระเงินที่จำเป็นสำหรับการทำธุรกรรมผ่านกระเป๋าเงินในแอป</InfoBullet>

      <InfoHeading>2. เราใช้ข้อมูลอย่างไร</InfoHeading>
      <InfoBullet>เพื่อจับคู่ผู้ฝากหิ้วและผู้รับหิ้วที่เหมาะสมกัน</InfoBullet>
      <InfoBullet>เพื่อคำนวณ Trust Score และดูแลความปลอดภัยภายในระบบ</InfoBullet>
      <InfoBullet>เพื่อแจ้งเตือนสถานะออเดอร์และการสื่อสารที่จำเป็นต่อการใช้งาน</InfoBullet>
      <InfoBullet>เพื่อปรับปรุงคุณภาพการให้บริการของแอปในภาพรวม</InfoBullet>

      <InfoHeading>3. การเปิดเผยข้อมูล</InfoHeading>
      <InfoParagraph>
        เราจะไม่เปิดเผยข้อมูลส่วนบุคคลของท่านให้บุคคลภายนอกเพื่อวัตถุประสงค์ทางการตลาด
        ข้อมูลบางส่วน เช่น ชื่อและคะแนนรีวิว จะแสดงให้คู่รายการเห็นเท่าที่จำเป็นต่อการทำธุรกรรมเท่านั้น
      </InfoParagraph>

      <InfoHeading>4. ความปลอดภัยของข้อมูล</InfoHeading>
      <InfoParagraph>
        ข้อมูลของท่านถูกจัดเก็บบนระบบที่มีการเข้ารหัส และจำกัดสิทธิ์การเข้าถึงเฉพาะทีมงานที่เกี่ยวข้องเท่านั้น
        เราตรวจสอบและปรับปรุงมาตรการความปลอดภัยอย่างสม่ำเสมอ
      </InfoParagraph>

      <InfoHeading>5. สิทธิของผู้ใช้งาน</InfoHeading>
      <InfoBullet>ขอเข้าถึงหรือแก้ไขข้อมูลส่วนบุคคลของตนเองได้ที่หน้าแก้ไขโปรไฟล์</InfoBullet>
      <InfoBullet>ขอให้ลบบัญชีและข้อมูลที่เกี่ยวข้องได้ผ่านเมนูตั้งค่า</InfoBullet>
      <InfoBullet>สอบถามเกี่ยวกับการใช้ข้อมูลของท่านได้ตลอดเวลาผ่านช่องทางติดต่อทีมงาน</InfoBullet>

      <InfoHeading>6. การเปลี่ยนแปลงนโยบาย</InfoHeading>
      <InfoParagraph>
        เราอาจปรับปรุงนโยบายความเป็นส่วนตัวนี้เป็นครั้งคราว
        และจะแจ้งให้ผู้ใช้งานทราบผ่านการแจ้งเตือนในแอปเมื่อมีการเปลี่ยนแปลงที่มีนัยสำคัญ
      </InfoParagraph>

      <InfoParagraph>ปรับปรุงล่าสุด: กรกฎาคม 2569</InfoParagraph>
    </InfoScreen>
  );
}
