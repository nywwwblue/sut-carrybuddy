import React from 'react';
import InfoScreen, { InfoHeading, InfoParagraph } from '@/components/InfoScreen';

export default function AboutScreen() {
  return (
    <InfoScreen title="เกี่ยวกับ SUT CarryBuddy">
      <InfoParagraph>
        SUT CarryBuddy คือแอปพลิเคชันฝากซื้อ-รับหิ้วสินค้าภายในรั้วมหาวิทยาลัยเทคโนโลยีสุรนารี
        ออกแบบมาเพื่อเชื่อมนักศึกษาที่อยากฝากซื้อของ (ผู้ฝาก) เข้ากับนักศึกษาที่สะดวกเดินทางและอยากรับงานหิ้วของ (ผู้รับหิ้ว)
        ให้สามารถช่วยเหลือกันเองภายในรั้วมหาวิทยาลัยได้อย่างสะดวก รวดเร็ว และปลอดภัย
      </InfoParagraph>

      <InfoHeading>พันธกิจของเรา</InfoHeading>
      <InfoParagraph>
        เราต้องการลดเวลาที่นักศึกษาต้องเสียไปกับการเดินทางไปซื้อของด้วยตนเอง
        พร้อมสร้างรายได้เสริมให้กับนักศึกษาที่มีเวลาว่างระหว่างวัน
        ผ่านระบบที่โปร่งใส ตรวจสอบได้ และมีมาตรการด้านความปลอดภัยของทั้งสองฝ่าย
      </InfoParagraph>

      <InfoHeading>ฟีเจอร์หลัก</InfoHeading>
      <InfoParagraph>
        ระบบจับคู่งานหิ้วตามเส้นทาง ระบบ Trust Score สำหรับประเมินความน่าเชื่อถือ
        กระเป๋าเงินในแอปสำหรับชำระค่าบริการ แชทพูดคุยระหว่างผู้ฝากและผู้รับหิ้วแบบเรียลไทม์
        และระบบแจ้งเตือนสถานะออเดอร์ตลอดเส้นทาง
      </InfoParagraph>

      <InfoHeading>ติดต่อทีมพัฒนา</InfoHeading>
      <InfoParagraph>
        หากพบปัญหาการใช้งานหรือมีข้อเสนอแนะ สามารถติดต่อทีมพัฒนาได้ที่อีเมล support@sutcarrybuddy.app
        ทีมงานของเรายินดีรับฟังทุกความคิดเห็นเพื่อพัฒนาแอปให้ดียิ่งขึ้น
      </InfoParagraph>

      <InfoParagraph>เวอร์ชันปัจจุบัน: 1.0.0</InfoParagraph>
    </InfoScreen>
  );
}
