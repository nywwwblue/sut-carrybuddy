// 📐 ฟังก์ชันคำนวณระยะทางพิกัด GPS ตามสูตร Haversine (หน่วย: เมตร)
export function checkDeliveryLocation(
  riderLat: number,
  riderLng: number,
  dropLat: number,
  dropLng: number,
  maxMeters: number = 100
) {
  const R = 6371e3; // รัศมีโลกเฉลี่ย (เมตร)
  const dLat = ((dropLat - riderLat) * Math.PI) / 180;
  const dLng = ((dropLng - riderLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((riderLat * Math.PI) / 180) *
      Math.cos((dropLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return {
    isAtLocation: distance <= maxMeters,
    distanceMeters: Math.round(distance),
  };
}
// Interface สำหรับผลการตรวจสอบ
export interface AIDeliveryReport {
  is_valid_delivery: boolean;
  is_damaged: boolean;
  damage_severity: "none" | "minor" | "severe";
  damage_description: string;
  confidence_score: number;
}

export async function verifyDeliveryProof(
  base64Image: string,
  dropoffName: string = "จุดส่งของ"
): Promise<AIDeliveryReport> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ ไม่พบ EXPO_PUBLIC_GEMINI_API_KEY ในไฟล์ .env");
    return {
      is_valid_delivery: false,
      is_damaged: true,
      damage_severity: "severe",
      damage_description: "ไม่พบ API Key สำหรับวิเคราะห์ภาพ",
      confidence_score: 0,
    };
  }

  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  const prompt = `
หน้าที่: ตรวจสอบภาพถ่ายหลักฐานการจัดส่งพัสดุ
1. มีการวางส่งพัสดุ/สินค้าจริงหรือไม่ (is_valid_delivery: true/false)
2. ประเมินความเสียหาย (damage_severity):
   - "none": สภาพปกติ สมบูรณ์
   - "minor": ชำรุดเล็กน้อย กล่องบุบ ถุงย่น มีรอยเปื้อนเล็กน้อย
   - "severe": แตกหัก ฉีกขาดรุนแรง กล่องแบน หรือมีของเหลวรั่วซึม
3. is_damaged: true หากเป็น minor หรือ severe, และ false หากเป็น none
4. damage_description: ข้อความสรุปสั้นๆ 1 ประโยค

ส่งผลลัพธ์เป็น JSON โครงสร้างนี้เท่านั้น:
{
  "is_valid_delivery": true,
  "is_damaged": false,
  "damage_severity": "none",
  "damage_description": "พัสดุอยู่ในสภาพสมบูรณ์",
  "confidence_score": 95
}
`;

  // รายชื่อโมเดลที่เสถียรและพร้อมให้บริการ (ถ้าตัวแรก 503 จะสลับไปตัวสำรองทันที)
  const candidateModels = [
    "gemini-3.7-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash"
  ];

  for (const modelName of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      console.log(`🚀 กำลังส่งภาพไปที่ [${modelName}]...`);

      const response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
            max_output_tokens: 1000,
          },
        }),
      });

      clearTimeout(timeoutId);

      // หากโมเดลติด 503 หรือ 429 ให้ข้ามไปใช้โมเดลสำรองตัวถัดไปทันที
      if (response.status === 503 || response.status === 429) {
        console.warn(`⚠️ โมเดล [${modelName}] คิวหนาแน่น (${response.status}) สลับไปโมเดลสำรอง...`);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`⚠️ [${modelName}] HTTP Error (${response.status}):`, errText);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`✅ ผลตรวจจาก [${modelName}]:`, rawText);

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new SyntaxError("ไม่พบรูปแบบ JSON ในข้อความตอบกลับ");
      }

      return JSON.parse(jsonMatch[0]);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.log(`❌ [${modelName}] ขัดข้อง:`, err?.name || err?.message || err);
      // ไปรอบถัดไปเพื่อเรียกโมเดลสำรอง
    }
  }

  return {
    is_valid_delivery: false,
    is_damaged: true,
    damage_severity: "severe",
    damage_description: "ระบบ AI ขัดข้องชั่วคราว กรุณากดลองใหม่อีกครั้ง",
    confidence_score: 0,
  };
}