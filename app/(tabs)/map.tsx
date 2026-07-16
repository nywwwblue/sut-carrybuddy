import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';

// พิกัดมหาวิทยาลัยเทคโนโลยีสุรนารี (SUT)
const SUT_LAT = 14.8818;
const SUT_LNG = 102.0173;

// แผนที่ OpenStreetMap ฝังผ่าน Leaflet 
// TODO: ปักหมุดร้านค้า/จุดดรอปจริงจากตาราง stores และ dropoff_locations โดยส่งข้อมูลผ่าน injectedJavaScript
const MAP_HTML = `
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
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    L.marker([${SUT_LAT}, ${SUT_LNG}]).addTo(map).bindPopup('มหาวิทยาลัยเทคโนโลยีสุรนารี');
  </script>
</body>
</html>
`;

export default function MapScreen() {
  const router = useRouter();
  const [filterTab, setFilterTab] = useState('ทั้งหมด');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>แผนที่ SUT</Text>
      </View>

      {/* Search Bar */}
      <TouchableOpacity style={styles.searchContainer} onPress={() => router.push('/search-results')}>
        <Ionicons name="search" size={20} color="#8B7E74" />
        <Text style={styles.searchPlaceholder}>ค้นหาร้านค้าหรือสถานที่...</Text>
      </TouchableOpacity>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['ทั้งหมด', 'ร้านค้า', 'Flash Buy'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filterTab === tab && styles.filterTabActive]}
            onPress={() => setFilterTab(tab)}
          >
            <Text style={[styles.filterTabText, filterTab === tab && styles.filterTabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <WebView
          source={{ html: MAP_HTML }}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8EF',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  searchPlaceholder: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#D4C5BA',
  },
  filterContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 12,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF7A30',
  },
  filterTabActive: {
    backgroundColor: '#FF7A30',
  },
  filterTabText: {
    fontSize: 13,
    color: '#FF7A30',
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
});
