import React from 'react';
import InfoScreen, { InfoHeading, InfoParagraph, InfoBullet } from '@/components/InfoScreen';

export default function TermsScreen() {
  return (
    <InfoScreen title="เงื่อนไขการใช้งาน">
      <InfoParagraph>
        เงื่อนไขการใช้งานฉบับนี้มีผลกับผู้ใช้งานแอปพลิเคชัน SUT CarryBuddy ทุกคน
        ไม่ว่าจะใช้งานในฐานะผู้ฝากหิ้วหรือผู้รับหิ้ว การใช้งานแอปถือว่าท่านยอมรับเงื่อนไขต่อไปนี้แล้ว
      </InfoParagraph>

      <InfoHeading>1. คุณสมบัติผู้ใช้งาน</InfoHeading>
      <InfoBullet>ต้องเป็นนักศึกษา บุคลากร หรือผู้ที่มีอีเมลมหาวิทยาลัยเทคโนโลยีสุรนารีที่ยังใช้งานได้</InfoBullet>
      <InfoBullet>ข้อมูลที่ใช้ลงทะเบียนต้องเป็นข้อมูลจริงและเป็นปัจจุบัน</InfoBullet>

      <InfoHeading>2. หน้าที่ของผู้ฝากหิ้ว</InfoHeading>
      <InfoBullet>ระบุรายการสินค้าและงบประมาณให้ชัดเจนตรงตามความเป็นจริง</InfoBullet>
      <InfoBullet>ชำระค่าสินค้าและค่าบริการตามที่ตกลงกันผ่านช่องทางที่แอปรองรับ</InfoBullet>
      <InfoBullet>ให้ความร่วมมือในการนัดรับสินค้าตามเวลาและสถานที่ที่ตกลงกัน</InfoBullet>

      <InfoHeading>3. หน้าที่ของผู้รับหิ้ว</InfoHeading>
      <InfoBullet>ซื้อสินค้าตรงตามรายการที่ผู้ฝากระบุ หากไม่มีสินค้าต้องแจ้งผู้ฝากก่อนเปลี่ยนแปลง</InfoBullet>
      <InfoBullet>รักษาสภาพสินค้าระหว่างการจัดส่งให้อยู่ในสภาพสมบูรณ์</InfoBullet>
      <InfoBullet>ส่งมอบสินค้าภายในระยะเวลาที่แจ้งไว้ในระบบ</InfoBullet>

      <InfoHeading>4. ระบบ Trust Score</InfoHeading>
      <InfoParagraph>
        แอปมีระบบประเมินคะแนนความน่าเชื่อถือของผู้ใช้งานจากประวัติการทำรายการ
        การยกเลิกงานบ่อยครั้งหรือพฤติกรรมที่ผิดเงื่อนไขอาจส่งผลให้คะแนนลดลง
        และอาจถูกจำกัดการใช้งานบางฟีเจอร์หรือระงับบัญชีชั่วคราว
      </InfoParagraph>

      <InfoHeading>5. ข้อจำกัดความรับผิดชอบ</InfoHeading>
      <InfoParagraph>
        SUT CarryBuddy เป็นเพียงแพลตฟอร์มตัวกลางที่เชื่อมผู้ใช้งานเข้าด้วยกัน
        ไม่ได้เป็นคู่สัญญาซื้อขายสินค้าโดยตรง ทีมงานจะช่วยไกล่เกลี่ยกรณีมีข้อพิพาทตามความเหมาะสม
        แต่ไม่รับผิดชอบความเสียหายที่เกิดจากการตกลงกันเองนอกเหนือระบบ
      </InfoParagraph>

      <InfoHeading>6. การระงับบัญชี</InfoHeading>
      <InfoParagraph>
        ทีมงานขอสงวนสิทธิ์ในการระงับหรือยกเลิกบัญชีผู้ใช้ที่ฝ่าฝืนเงื่อนไขการใช้งาน
        ก่อกวนผู้ใช้งานรายอื่น หรือใช้แอปเพื่อวัตถุประสงค์ที่ผิดกฎหมาย
      </InfoParagraph>

      <InfoParagraph>ปรับปรุงล่าสุด: กรกฎาคม 2569</InfoParagraph>
    </InfoScreen>
  );
}
