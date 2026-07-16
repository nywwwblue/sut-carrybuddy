import { Redirect } from 'expo-router';

// เก็บไฟล์นี้ไว้เพื่อ backward-compat กับลิงก์เก่าที่อาจยังชี้มาที่ /runner-home
// เนื้อหาจริงของ Runner Mode ย้ายไปอยู่ที่กลุ่มแท็บ (runner-tabs) แล้ว
export default function RunnerHomeRedirect() {
  return <Redirect href="/(runner-tabs)" />;
}
