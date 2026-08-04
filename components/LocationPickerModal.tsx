import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { supabase } from '@/lib/supabase';

const SUT_LAT = 14.8818;
const SUT_LNG = 102.0173;

export type PickedLocation =
  | { type: 'preset'; id: number; name: string; lat?: number; lng?: number }
  | { type: 'custom'; lat: number; lng: number; label: string };

interface Props {
  visible: boolean;
  kind: 'store' | 'dropoff'; // เลือกว่าจะ query preset จากตาราง stores หรือ dropoff_locations
  onClose: () => void;
  onSelect: (location: PickedLocation) => void;
}

type Mode = 'preset' | 'current' | 'pin';

// 🎨 HTML Leaflet ฉบับปรับปรุง (ใช้ Custom Red Marker เด่นชัด + ลากหมุดลื่นไหล ไม่กระตุก)
const PIN_MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html,body,#map{height:100%;margin:0;padding:0;}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([${SUT_LAT}, ${SUT_LNG}], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // หมุดสีแดงเด่นชัดสำหรับจุดปักหมุด custom 🔴
    const redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });

    let marker = L.marker([${SUT_LAT}, ${SUT_LNG}], { draggable: true, icon: redIcon }).addTo(map);

    function sendPosition(pos) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ lat: pos.lat, lng: pos.lng }));
      }
    }

    marker.on('dragend', () => sendPosition(marker.getLatLng()));
    
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      sendPosition(e.latlng);
    });

    sendPosition(marker.getLatLng());
  </script>
</body>
</html>
`;

export function LocationPickerModal({ visible, kind, onClose, onSelect }: Props) {
  const [mode, setMode] = useState<Mode>('preset');
  const [searchText, setSearchText] = useState('');
  const [presets, setPresets] = useState<{ id: number; name: string; category?: string; zone?: string; lat?: number; lng?: number }[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [pinCoords, setPinCoords] = useState({ lat: SUT_LAT, lng: SUT_LNG });
  const [pinLabel, setPinLabel] = useState('');

  // ดึง Preset จาก Supabase
  const loadPresets = useCallback(async () => {
    setLoadingPresets(true);
    const table = kind === 'store' ? 'stores' : 'dropoff_locations';
    const selectFields = kind === 'store' ? 'id, name, category, lat, lng' : 'id, name, zone, lat, lng';

    const { data, error } = await supabase
      .from(table)
      .select(selectFields)
      .ilike('name', `%${searchText}%`)
      .limit(30);

    if (!error && data) {
      setPresets(data as any[]);
    }
    setLoadingPresets(false);
  }, [kind, searchText]);

  useEffect(() => {
    if (visible && mode === 'preset') {
      const t = setTimeout(loadPresets, 250);
      return () => clearTimeout(t);
    }
  }, [visible, mode, loadPresets]);

  // ใช้ตำแหน่ง GPS ปัจจุบัน + ดึงชื่อสถานที่จริง (Reverse Geocoding)
  const handleUseCurrentLocation = async () => {
    setLoadingGps(true);
    
    // 1. ขออนุญาตเข้าถึงสิทธิ์ Location
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLoadingGps(false);
      Alert.alert('ไม่ได้รับอนุญาต', 'กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อใช้ฟีเจอร์นี้');
      return;
    }

    try {
      // 2. ดึงพิกัด GPS ปัจจุบัน
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // เพิ่มความแม่นยำของพิกัด
      });

      const { latitude, longitude } = pos.coords;

      // 3. 🔍 แปลงพิกัด (Lat, Lng) เป็นชื่อสถานที่/ที่อยู่จริง (Reverse Geocode)
      const reverseResult = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      let readableAddress = 'ตำแหน่งปัจจุบันของฉัน';

      if (reverseResult && reverseResult.length > 0) {
        const place = reverseResult[0];
        
        // จัดรูปแบบชื่อสถานที่ให้เข้าใจง่าย
        const nameParts = [
          place.name || place.street,
          place.district || place.subregion,
          place.city,
        ].filter(Boolean); // ลบค่าที่เป็น null/undefined ออก

        if (nameParts.length > 0) {
          readableAddress = nameParts.join(', ');
        }
      }

      setLoadingGps(false);

      // 4. ส่งข้อมูลทั้ง พิกัดจริง และ ชื่อสถานที่จริง กลับไป
      onSelect({
        type: 'custom',
        lat: latitude,
        lng: longitude,
        label: readableAddress, // <-- จะได้ชื่อที่อยู่จริง เช่น "ถนนมหาวิทยาลัย, เมืองนครราชสีมา"
      });

      onClose();
    } catch (e) {
      setLoadingGps(false);
      Alert.alert('ผิดพลาด', 'ไม่สามารถดึงตำแหน่งปัจจุบันได้ ลองใหม่อีกครั้ง');
    }
  };

  // ยืนยันการปักหมุดเอง
  const handleConfirmPin = () => {
    if (!pinLabel.trim()) {
      Alert.alert('ใส่ชื่อสถานที่ก่อน', 'กรุณาตั้งชื่อจุดที่ปักหมุดไว้ เพื่อให้อีกฝ่ายเข้าใจง่าย');
      return;
    }
    onSelect({ 
      type: 'custom', 
      lat: pinCoords.lat, 
      lng: pinCoords.lng, 
      label: pinLabel.trim() 
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#3A2113" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {kind === 'store' ? 'เลือกหมุดร้านค้า / จุดรับ' : 'เลือกหมุดจุดส่งของ'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Mode Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, mode === 'preset' && styles.tabActive]} onPress={() => setMode('preset')}>
            <Text style={[styles.tabText, mode === 'preset' && styles.tabTextActive]}>เลือกจากรายการ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, mode === 'current' && styles.tabActive]} onPress={() => setMode('current')}>
            <Text style={[styles.tabText, mode === 'current' && styles.tabTextActive]}>ตำแหน่งของฉัน</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, mode === 'pin' && styles.tabActive]} onPress={() => setMode('pin')}>
            <Text style={[styles.tabText, mode === 'pin' && styles.tabTextActive]}>ปักหมุดเอง</Text>
          </TouchableOpacity>
        </View>

        {/* 1. Preset List */}
        {mode === 'preset' && (
          <View style={{ flex: 1 }}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#8B7E74" />
              <TextInput
                style={styles.searchInput}
                placeholder={kind === 'store' ? 'ค้นหาร้านค้า...' : 'ค้นหาจุดส่ง...'}
                placeholderTextColor="#B0A498"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
            {loadingPresets ? (
              <ActivityIndicator color="#FF7A30" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={presets}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.presetItem}
                    onPress={() => {
                      onSelect({ 
                        type: 'preset', 
                        id: item.id, 
                        name: item.name, 
                        lat: item.lat, 
                        lng: item.lng 
                      });
                      onClose();
                    }}
                  >
                    <Ionicons name="location" size={18} color="#FF7A30" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.presetName}>{item.name}</Text>
                      {!!(item.category || item.zone) && (
                        <Text style={styles.presetSub}>{item.category || item.zone}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>ไม่พบสถานที่ที่ค้นหา</Text>}
              />
            )}
          </View>
        )}

        {/* 2. Current Location */}
        {mode === 'current' && (
          <View style={styles.centerContent}>
            <Ionicons name="navigate-circle" size={64} color="#FF7A30" />
            <Text style={styles.currentText}>ใช้ตำแหน่ง GPS ปัจจุบันของคุณเป็นจุดนี้</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleUseCurrentLocation} disabled={loadingGps}>
              {loadingGps ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>ใช้ตำแหน่งของฉันตอนนี้</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* 3. Pin on Map */}
        {mode === 'pin' && (
          <View style={{ flex: 1 }}>
            <View style={styles.pinMapContainer}>
              <WebView
                source={{ html: PIN_MAP_HTML }}
                style={{ flex: 1 }}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={['*']}
                onMessage={(e) => {
                  try {
                    const data = JSON.parse(e.nativeEvent.data);
                    setPinCoords({ lat: data.lat, lng: data.lng });
                  } catch {}
                }}
              />
            </View>
            <Text style={styles.pinHint}>แตะบนแผนที่หรือลากหมุดสีแดง 🔴 เพื่อเลือกตำแหน่ง</Text>
            <TextInput
              style={styles.labelInput}
              placeholder="ตั้งชื่อจุดนี้ เช่น 'หน้าหอพัก B'"
              placeholderTextColor="#B0A498"
              value={pinLabel}
              onChangeText={setPinLabel}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmPin}>
              <Text style={styles.primaryBtnText}>ยืนยันตำแหน่งนี้</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8EF', paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#3A2113' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8D5C4', alignItems: 'center' },
  tabActive: { backgroundColor: '#FF7A30', borderColor: '#FF7A30' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#8B7E74' },
  tabTextActive: { color: '#FFFFFF' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF',
    marginHorizontal: 20, marginTop: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E8D5C4',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#3A2113' },
  presetItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF',
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E8D5C4',
  },
  presetName: { fontSize: 14, fontWeight: '600', color: '#3A2113' },
  presetSub: { fontSize: 12, color: '#8B7E74', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#8B7E74', marginTop: 20 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 16 },
  currentText: { fontSize: 14, color: '#3A2113', textAlign: 'center' },
  pinMapContainer: { flex: 1, marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  pinHint: { textAlign: 'center', fontSize: 12, color: '#8B7E74', marginBottom: 10 },
  labelInput: {
    marginHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E8D5C4',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#3A2113', marginBottom: 12,
  },
  primaryBtn: { marginHorizontal: 20, backgroundColor: '#FF7A30', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
});