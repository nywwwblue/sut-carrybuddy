import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, TextInput, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { supabase } from '@/lib/supabase'; // 1. Import Supabase client

// พิกัดศูนย์กลาง มทส. (SUT)
const SUT_LAT = 14.8818;
const SUT_LNG = 102.0173;

interface LocationItem {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
}

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .leaflet-popup-content-wrapper { border-radius: 8px; font-family: sans-serif; }
    .popup-btn { 
      background-color: #FF7A30; color: white; border: none; 
      padding: 6px 12px; border-radius: 4px; margin-top: 8px; cursor: pointer; width: 100%;
    }
    
    /* 🏷️ สไตล์ป้ายชื่อสถานที่ใต้จุดวงกลม */
    .location-label {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #FF7A30;
      color: #3A2113;
      font-weight: bold;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      white-space: nowrap;
    }
    .leaflet-tooltip-top:before {
      border-top-color: #FF7A30;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([${SUT_LAT}, ${SUT_LNG}], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // 🔴 ไอคอนหมุดสีแดง (สำหรับอันที่เลือกเท่านั้น)
    const redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    let markersGroup = L.layerGroup().addTo(map);
    let circleMap = {}; 
    let activePinMarker = null; // เก็บอ้างอิงหมุดสีแดงอันเดียวที่กำลังถูกเลือก

    // ฟังก์ชันลบหมุดสีแดงเดิมออก (ถ้ามี)
    function clearActivePin() {
      if (activePinMarker) {
        map.removeLayer(activePinMarker);
        activePinMarker = null;
      }
    }

    // ฟังก์ชันอัปเดตจุดมาร์กวงกลมพร้อมป้ายชื่อ
    function updateMarkers(locations) {
      markersGroup.clearLayers();
      circleMap = {};
      clearActivePin();
      const bounds = [];

      locations.forEach(loc => {
        if (!loc.lat || !loc.lng) return;

        // 🟢 สร้างจุดมาร์กวงกลมสีส้มเล็กๆ
        const circle = L.circleMarker([loc.lat, loc.lng], {
          radius: 7,
          color: '#FFFFFF',
          weight: 2,
          fillColor: '#FF7A30',
          fillOpacity: 0.9
        });

        // 🏷️ แสดงชื่อสถานที่ลอยอยู่เหนือจุดวงกลมตลอดเวลา
        circle.bindTooltip(loc.name, {
          permanent: true,
          direction: 'top',
          offset: [0, -6],
          className: 'location-label'
        });

        // เมื่อผู้ใช้กดที่จุดวงกลม -> สร้างหมุดสีแดงปักทับจุดนั้นทันที
        circle.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          selectAndPinLocation(loc);
        });

        markersGroup.addLayer(circle);
        circleMap[loc.id] = circle;
        bounds.push([loc.lat, loc.lng]);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }

    // 📍 ฟังก์ชันสร้างหมุดปักสีแดงแค่อันเดียวตรงสถานที่ที่เลือก
    function selectAndPinLocation(loc) {
      clearActivePin();

      // สร้างหมุดสีแดงปักตรงตำแหน่งที่กด
      activePinMarker = L.marker([loc.lat, loc.lng], { icon: redIcon }).addTo(map);

      const popupContent = \`
        <div style="text-align: center;">
          <b style="color: #3A2113;">\${loc.name}</b><br/>
          <small style="color: #8B7E74;">\${loc.category || ''}</small><br/>
          <button class="popup-btn" onclick="selectLocation('\${loc.id}', '\${loc.name}', \${loc.lat}, \${loc.lng})">เลือกสถานที่นี้</button>
        </div>
      \`;

      activePinMarker.bindPopup(popupContent).openPopup();
    }

    function focusLocation(loc) {
      if (!loc.lat || !loc.lng) return;
      map.setView([loc.lat, loc.lng], 17, { animate: true });
      selectAndPinLocation(loc);
    }

    // 📍 แตะปักหมุดเองบนพื้นที่ว่างของแผนที่
    map.on('click', function(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      clearActivePin();

      activePinMarker = L.marker([lat, lng], { icon: redIcon }).addTo(map);
      const popupContent = \`
        <div style="text-align: center;">
          <b style="color: #3A2113;">จุดที่เลือกเอง</b><br/>
          <small style="color: #8B7E74;">Lat: \${lat.toFixed(4)}, Lng: \${lng.toFixed(4)}</small><br/>
          <button class="popup-btn" onclick="selectLocation('custom', 'จุดที่เลือกบนแผนที่', \${lat}, \${lng})">เลือกจุดนี้</button>
        </div>
      \`;
      activePinMarker.bindPopup(popupContent).openPopup();
    });

    function selectLocation(id, name, lat, lng) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'SELECT_LOCATION',
          payload: { id, name, lat, lng }
        }));
      }
    }

    function handleMessage(event) {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'SET_LOCATIONS') {
          updateMarkers(data.payload);
        } else if (data.type === 'FOCUS_LOCATION') {
          focusLocation(data.payload);
        }
      } catch (e) {
        console.error(e);
      }
    }

    document.addEventListener("message", handleMessage);
    window.addEventListener("message", handleMessage);

    setTimeout(function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
      }
    }, 500);
  </script>
</body>
</html>
`;

export default function MapScreen() {
  const webViewRef = useRef<WebView>(null);
  const [filterTab, setFilterTab] = useState('ทั้งหมด');
  
  // 2. State สำหรับเก็บข้อมูลสถานที่จาก Supabase
  const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 3. ฟังก์ชันดึงข้อมูลจากตาราง stores และ dropoff_locations
  const fetchLocationsFromSupabase = async () => {
    setLoading(true);
    try {
      // ดึงร้านค้าจากตาราง stores
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name, category, lat, lng')
        .eq('is_active', true)
        .not('lat', 'is', null);

      if (storesError) throw storesError;

      // ดึงจุดส่งจากตาราง dropoff_locations
      const { data: dropoffsData, error: dropoffsError } = await supabase
        .from('dropoff_locations')
        .select('id, name, zone, lat, lng')
        .not('lat', 'is', null);

      if (dropoffsError) throw dropoffsError;

      // แปลงข้อมูลให้อยู่ในรูปแบบเดียวกัน
      const formattedStores: LocationItem[] = (storesData || []).map((item) => ({
        id: `store_${item.id}`,
        name: item.name,
        category: item.category || 'ร้านค้า',
        lat: Number(item.lat),
        lng: Number(item.lng),
      }));

      const formattedDropoffs: LocationItem[] = (dropoffsData || []).map((item) => ({
        id: `dropoff_${item.id}`,
        name: item.name,
        category: 'Flash Buy', // หรือใส่เป็น item.zone
        lat: Number(item.lat),
        lng: Number(item.lng),
      }));

      const combined = [...formattedStores, ...formattedDropoffs];
      setAllLocations(combined);
      sendLocationsToMap(filterTab, combined);
    } catch (err: any) {
      console.error('Error fetching locations:', err.message);
      Alert.alert('ผิดพลาด', 'ไม่สามารถดึงข้อมูลสถานที่ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocationsFromSupabase();
  }, []);

  const sendLocationsToMap = (selectedFilter: string, dataList = allLocations) => {
    const filtered = selectedFilter === 'ทั้งหมด' 
      ? dataList 
      : dataList.filter(item => item.category === selectedFilter);

    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'SET_LOCATIONS',
        payload: filtered
      }));
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setSearchResults([]);
      setIsSearching(false);
    } else {
      setIsSearching(true);
      const filtered = allLocations.filter(item => 
        item.name.toLowerCase().includes(text.toLowerCase())
      );
      setSearchResults(filtered);
    }
  };

  const handleSelectSearchResult = (location: LocationItem) => {
    setSearchQuery(location.name);
    setIsSearching(false);

    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'FOCUS_LOCATION',
        payload: location
      }));
    }
  };

  const handleFilterChange = (tab: string) => {
    setFilterTab(tab);
    sendLocationsToMap(tab);
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_READY') {
        sendLocationsToMap(filterTab);
      }
      if (data.type === 'SELECT_LOCATION') {
        const { name, lat, lng } = data.payload;
        Alert.alert('เลือกสถานที่สำเร็จ', `สถานที่: ${name}\nพิกัด: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>แผนที่ SUT</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8B7E74" />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาร้านค้าหรือสถานที่..."
            placeholderTextColor="#D4C5BA"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color="#8B7E74" />
            </TouchableOpacity>
          )}
        </View>

        {/* Dropdown */}
        {isSearching && (
          <View style={styles.searchResultsDropdown}>
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.searchResultItem}
                    onPress={() => handleSelectSearchResult(item)}
                  >
                    <Ionicons name="location-outline" size={18} color="#FF7A30" />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.searchResultText}>{item.name}</Text>
                      <Text style={styles.searchResultSubText}>{item.category}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={styles.searchResultItem}>
                <Text style={styles.searchResultSubText}>ไม่พบสถานที่ที่ค้นหา</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['ทั้งหมด', 'ร้านค้า', 'ร้านอาหาร', 'คาเฟ่', 'โรงอาหาร', 'Flash Buy'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filterTab === tab && styles.filterTabActive]}
            onPress={() => handleFilterChange(tab)}
          >
            <Text style={[styles.filterTabText, filterTab === tab && styles.filterTabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#FF7A30" />
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: MAP_HTML }}
            style={styles.map}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={['*']}
            onMessage={handleWebViewMessage}
          />
        )}
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
  searchWrapper: {
    zIndex: 10,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#3A2113',
  },
  searchResultsDropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    maxHeight: 200,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EBE1',
  },
  searchResultText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A2113',
  },
  searchResultSubText: {
    fontSize: 12,
    color: '#8B7E74',
  },
  filterContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF7A30',
  },
  filterTabActive: {
    backgroundColor: '#FF7A30',
  },
  filterTabText: {
    fontSize: 12,
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