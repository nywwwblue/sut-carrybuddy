import { GoogleGenerativeAI } from '@google/generative-ai';

// เชื่อมต่อ Gemini API 
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_KEY || '');

export interface FeeResult {
  suggested:   number;   // ค่าหิ้วแนะนำ
  min:         number;
  max:         number;
  reason:      string;   // อธิบายเหตุผลให้ User ฟัง
  weather:     string;
  time_slot:   string;
  is_peak:     boolean;
}

// 1. ดึงข้อมูลสภาพอากาศพิกัด มทส.
async function getWeather(): Promise<string> {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=14.8795&longitude=102.0164&current=precipitation,weathercode&timezone=Asia/Bangkok'
    );
    const data = await res.json();
    const rain = data.current.precipitation;
    const code = data.current.weathercode;
    
    if (rain > 2 || (code >= 61 && code <= 99)) return 'rain';
    if (code >= 95) return 'storm';
    
    return 'clear';
  } catch {
    return 'clear';
  }
}

// 2. เช็คเวลาว่าเป็นช่วงเร่งด่วนไหม
function getTimeSlot(): string {
  const h = new Date().getHours();
  if (h >= 6  && h < 9)  return 'morning';
  if (h >= 11 && h < 13) return 'lunch_rush';  // ช่วงพักเที่ยง
  if (h >= 17 && h < 19) return 'evening_rush';// ช่วงเย็นเลิกเรียน
  if (h >= 22 || h < 6)  return 'night';       // ดึก
  return 'normal';
}

// 3. ฟังก์ชันหลัก: ส่งข้อมูลบริบทรอบข้างให้ AI วิเคราะห์
export async function suggestFee(params: {
  store_name:   string;
  dropoff_name: string;
  item_count:   number;
  vehicle:      string;
}): Promise<FeeResult> {
  
  const weather = await getWeather();
  const timeSlot = getTimeSlot();
  const isPeak = timeSlot === 'lunch_rush' || timeSlot === 'evening_rush';

  // แปลงสภาพอากาศเป็นภาษาไทยให้ AI เข้าใจง่ายขึ้น
  const weatherTh = weather === 'rain' ? 'ฝนตก' : weather === 'storm' ? 'พายุเข้า' : 'ปกติ';

  // รวบรวมข้อมูลเป็นคำสั่ง (Prompt)
  const prompt = `
    คุณคือระบบ AI ผู้เชี่ยวชาญการประเมินค่าฝากหิ้วของใน มทส. (มหาวิทยาลัยเทคโนโลยีสุรนารี)
    วิเคราะห์ราคาจากข้อมูลปัจจุบัน:
    - ร้านต้นทาง: ${params.store_name}
    - จุดส่งปลายทาง: ${params.dropoff_name}
    - จำนวนสินค้า: ${params.item_count} ชิ้น
    - พาหนะ: ${params.vehicle}
    - สภาพอากาศ: ${weatherTh}
    - ช่วงเวลา: ${timeSlot}

    กฎการคิดราคา:
    - ราคาฐาน (Base Price): 10-15 บาท (ใกล้ๆ เดินได้)
    - บวก 5 บาท ทันทีถ้าสภาพอากาศ "ฝนตก" หรือ "พายุเข้า"
    - บวก 3 บาท ถ้าเป็นช่วง peak hour (lunch_rush หรือ evening_rush)
    - บวก 2 บาท ต่อทุกๆ 3 รายการที่เกิน 3 ชิ้นแรก
    - ราคาควรสมเหตุสมผลสำหรับนักศึกษา ไม่ควรเกิน 50 บาท

    ตอบกลับเป็น JSON เท่านั้น โครงสร้างดังนี้ (ห้ามมี Markdown):
    {
      "suggested": (ตัวเลขราคาแนะนำ),
      "min": (ตัวเลขราคาต่ำสุด),
      "max": (ตัวเลขราคาสูงสุด),
      "reason": "อธิบายเหตุผลสั้นๆ 1 ประโยค เช่น 'บวกเพิ่ม 5 บาทเนื่องจากฝนตกและเป็นช่วงพักเที่ยง'"
    }
  `;

  try {
    // บังคับให้ออกมาเป็น JSON เพื่อไม่ให้แอปพัง
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview',
      generationConfig: { responseMimeType: "application/json" } 
    });
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    return {
      suggested: parsed.suggested || 15,
      min: parsed.min || 10,
      max: parsed.max || 20,
      reason: parsed.reason || 'เรทราคามาตรฐาน',
      weather: weather,
      time_slot: timeSlot,
      is_peak: isPeak,
    };
  } catch (error) {
    console.error("Gemini AI Error:", error);
    // หากมี Error (เช่น เน็ตหลุด) ให้ใช้ราคามาตรฐาน 15 บาท
    return {
      suggested: 15, min: 10, max: 20, reason: 'เรทราคามาตรฐาน (AI ขัดข้องชั่วคราว)',
      weather, time_slot: timeSlot, is_peak: isPeak
    };
  }
}