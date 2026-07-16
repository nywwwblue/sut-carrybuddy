import React from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface EditableItem {
  name: string;
  quantity: string;
  price: string;
  note?: string;
}

interface Props {
  items: EditableItem[];
  onChange: (items: EditableItem[]) => void;
}

// ใช้ร่วมกันใน create-order.tsx และหน้าโพสต์ฝากหิ้วแบบเปิด (open-request)
export function ItemListEditor({ items, onChange }: Props) {
  const updateItem = (index: number, field: keyof EditableItem, value: string) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { name: '', quantity: '1', price: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return; // เหลืออย่างน้อย 1 แถวเสมอ
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <View key={index} style={styles.itemRow}>
          <View style={styles.itemRowHeader}>
            <Text style={styles.itemLabel}>รายการที่ {index + 1}</Text>
            {items.length > 1 && (
              <TouchableOpacity onPress={() => removeItem(index)}>
                <Ionicons name="trash" size={18} color="#E74C3C" />
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder="ชื่อสินค้า เช่น ชานมไข่มุก"
            placeholderTextColor="#B0A498"
            value={item.name}
            onChangeText={(v) => updateItem(index, 'name', v)}
          />

          <View style={styles.rowFields}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>จำนวน</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={item.quantity}
                onChangeText={(v) => updateItem(index, 'quantity', v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>ราคาโดยประมาณ</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#B0A498"
                value={item.price}
                onChangeText={(v) => updateItem(index, 'price', v)}
              />
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={addItem}>
        <Ionicons name="add-circle" size={18} color="#FF7A30" />
        <Text style={styles.addBtnText}>เพิ่มรายการสินค้า</Text>
      </TouchableOpacity>
    </View>
  );
}

export function calcItemTotal(items: EditableItem[]) {
  return items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  itemRow: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, gap: 10,
    borderWidth: 1, borderColor: '#E8D5C4',
  },
  itemRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemLabel: { fontSize: 12, fontWeight: '700', color: '#8B7E74' },
  fieldLabel: { fontSize: 11, color: '#8B7E74', marginBottom: 4 },
  input: {
    backgroundColor: '#FFF8EF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: '#3A2113',
  },
  rowFields: { flexDirection: 'row', gap: 10 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: '#FF7A30', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12,
  },
  addBtnText: { color: '#FF7A30', fontWeight: '600', fontSize: 13 },
});
