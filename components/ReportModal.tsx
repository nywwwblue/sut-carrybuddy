import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  TextInput, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const REASONS = [
  'ข้อมูลเป็นเท็จ',
  'ค่าหิ้วไม่สมเหตุสมผล',
  'บัญชีน่าสงสัย',
  'พฤติกรรมไม่เหมาะสม',
  'อื่นๆ (ระบุด้านล่าง)',
];

type TargetType = 'post' | 'user' | 'order';

interface Props {
  visible: boolean;
  onClose: () => void;
  targetType: TargetType;
  targetId?: number;        // สำหรับ post / order
  targetUuid?: string;      // สำหรับ user
  targetLabel?: string;     // ชื่อที่แสดง เช่น "โพสต์ของมาร์ค"
}

export default function ReportModal({
  visible, onClose,
  targetType, targetId, targetUuid, targetLabel,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setSelected(null);
    setCustomNote('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selected) {
      Alert.alert('กรุณาเลือกเหตุผล');
      return;
    }

    const finalReason = selected === 'อื่นๆ (ระบุด้านล่าง)'
      ? (customNote.trim() || 'ไม่ระบุ')
      : selected;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    const { error } = await supabase.from('dispute_reports').insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId ?? null,
      target_uuid: targetUuid ?? null,
      reason: finalReason,
    });
    setLoading(false);

    if (error) {
      Alert.alert('เกิดข้อผิดพลาด', error.message);
      return;
    }

    Alert.alert(
      'ส่งรายงานแล้ว',
      'เราจะตรวจสอบและดำเนินการภายใน 24 ชั่วโมง ขอบคุณที่ช่วยดูแลชุมชน',
      [{ text: 'ตกลง', onPress: handleClose }],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.sheetHeader}>
            <View>
              <Text style={s.sheetTitle}>รายงาน</Text>
              {targetLabel && (
                <Text style={s.sheetSub}>{targetLabel}</Text>
              )}
            </View>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={22} color="#8B7E74" />
            </TouchableOpacity>
          </View>

          <Text style={s.label}>เลือกเหตุผล</Text>

          {/* Reason list */}
          {REASONS.map(r => (
            <TouchableOpacity
              key={r}
              style={[s.reasonRow, selected === r && s.reasonRowSelected]}
              onPress={() => setSelected(r)}
            >
              <View style={[s.radio, selected === r && s.radioSelected]}>
                {selected === r && (
                  <View style={s.radioDot} />
                )}
              </View>
              <Text style={[s.reasonTxt, selected === r && s.reasonTxtSelected]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Custom note — แสดงเมื่อเลือก "อื่นๆ" */}
          {selected === 'อื่นๆ (ระบุด้านล่าง)' && (
            <TextInput
              style={s.noteInput}
              placeholder="อธิบายรายละเอียดเพิ่มเติม..."
              placeholderTextColor="#B0A498"
              value={customNote}
              onChangeText={setCustomNote}
              multiline
              maxLength={200}
            />
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, (!selected || loading) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!selected || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.submitTxt}>ส่งรายงาน</Text>
            }
          </TouchableOpacity>

          <Text style={s.disclaimer}>
            รายงานที่เป็นเท็จอาจส่งผลต่อ Trust Score ของผู้รายงาน
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF8EF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#3A2113' },
  sheetSub: { fontSize: 12, color: '#8B7E74', marginTop: 2 },
  label: { fontSize: 13, fontWeight: '700', color: '#3A2113', marginBottom: 10 },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: '#F0DAB8', marginBottom: 8,
  },
  reasonRowSelected: { borderColor: '#FF7A30', backgroundColor: '#FFF0E0' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#D0C4BC',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: '#FF7A30' },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#FF7A30',
  },
  reasonTxt: { fontSize: 14, color: '#3A2113', flex: 1 },
  reasonTxtSelected: { fontWeight: '600', color: '#C44F0F' },
  noteInput: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#F0DAB8',
    padding: 12, fontSize: 14, color: '#3A2113',
    minHeight: 80, textAlignVertical: 'top', marginBottom: 8,
  },
  submitBtn: {
    backgroundColor: '#FF7A30', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: '#FFB899' },
  submitTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disclaimer: {
    fontSize: 11, color: '#B0A498', textAlign: 'center', marginTop: 12,
  },
});s