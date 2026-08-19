import React, { useCallback, useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert, 
  Linking, 
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Image
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ORDER_THEME } from '@/constants/OrderTheme';
import { StatusPill } from '@/components/StatusPill';

// 📐 ฟังก์ชันคำนวณระยะทางทางตรงและแปลงเป็นเมตร/กิโลเมตร
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function calculateETA(distanceMeters: number) {
  const estimatedRoadDistance = distanceMeters * 1.35;
  const SPEED_METERS_PER_MIN = 416; // 25 กม./ชม.
  const minutes = Math.ceil(estimatedRoadDistance / SPEED_METERS_PER_MIN);

  let distanceText = '';
  if (estimatedRoadDistance >= 1000) {
    distanceText = `${(estimatedRoadDistance / 1000).toFixed(1)} กิโลเมตร`;
  } else {
    distanceText = `${Math.round(estimatedRoadDistance)} เมตร`;
  }

  return { distanceText, minutes: minutes < 1 ? 1 : minutes };
}

function formatDisplayDate(value?: string | null) {
  if (!value) return 'ไม่ทราบวันที่';
  try {
    return new Date(value).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'ไม่ทราบวันที่';
  }
}

// 📡 คอมโพเนนต์ LiveTrackingCard สำหรับคนฝากหิ้ว
function LiveTrackingCard({ orderId, dropoffLat, dropoffLng }: { orderId: number | string; dropoffLat: number; dropoffLng: number }) {
  const [etaInfo, setEtaInfo] = useState<{ distanceText: string; minutes: number } | null>(null);

  useEffect(() => {
    if (!orderId || !dropoffLat || !dropoffLng) return;

    const fetchInitialLocation = async () => {
      const { data } = await supabase
        .from('runner_locations')
        .select('lat, lng')
        .eq('order_id', orderId)
        .single();

      if (data?.lat && data?.lng) {
        const meters = getDistanceInMeters(Number(data.lat), Number(data.lng), dropoffLat, dropoffLng);
        setEtaInfo(calculateETA(meters));
      }
    };

    fetchInitialLocation();

    const channel = supabase
      .channel(`runner-location-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'runner_locations',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const newLoc = payload.new as { lat: number; lng: number };
          if (newLoc?.lat && newLoc?.lng) {
            const meters = getDistanceInMeters(Number(newLoc.lat), Number(newLoc.lng), dropoffLat, dropoffLng);
            setEtaInfo(calculateETA(meters));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, dropoffLat, dropoffLng]);

  if (!etaInfo) {
    return (
      <View style={trackingStyles.card}>
        <Ionicons name="bicycle" size={22} color="#8B7E74" />
        <Text style={trackingStyles.waitingText}>กำลังรอสัญญาณ GPS สดจากผู้รับหิ้ว...</Text>
      </View>
    );
  }

  return (
    <View style={trackingStyles.card}>
      <View style={trackingStyles.headerRow}>
        <View style={trackingStyles.liveBadge}>
          <View style={trackingStyles.greenDot} />
          <Text style={trackingStyles.liveText}>ติดตามสด (LIVE)</Text>
        </View>
        <Text style={trackingStyles.distanceText}>ห่างจากคุณ {etaInfo.distanceText}</Text>
      </View>

      <View style={trackingStyles.etaContainer}>
        <Ionicons name="time" size={26} color="#FF7A30" />
        <View>
          <Text style={trackingStyles.etaTitle}>คาดว่าจะถึงจุดส่งในอีก</Text>
          <Text style={trackingStyles.etaValue}>ประมาณ {etaInfo.minutes} นาที</Text>
        </View>
      </View>
    </View>
  );
}

const STEP_ORDER = ['pending', 'accepted', 'buying', 'bought', 'delivering', 'completed'];
const STEP_LABELS: Record<string, string> = {
  pending: 'รอผู้รับหิ้วตอบรับ',
  accepted: 'รับออเดอร์แล้ว',
  buying: 'กำลังซื้อสินค้า',
  bought: 'ซื้อแล้ว รอนำส่ง',
  delivering: 'กำลังเดินทาง',
  completed: 'จัดส่งสำเร็จ',
  disputed: 'อยู่ระหว่างตรวจสอบข้อพิพาท',
  cancelled: 'ยกเลิกออเดอร์แล้ว',
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['accepted'],
  accepted: ['buying'],
  buying: ['bought'],
  bought: ['delivering'],
  delivering: ['completed'],
};

function canTransitionTo(currentStatus: string, nextStatus: string) {
  if (!currentStatus || currentStatus === 'completed' || currentStatus === 'cancelled' || currentStatus === 'disputed') return false;
  return (ALLOWED_TRANSITIONS[currentStatus] || []).includes(nextStatus);
}

const RUNNER_DISPUTE_REASONS = [
  'ลูกค้าปฏิเสธการรับสินค้า / ตีกลับออเดอร์',
  'ลูกค้าไม่ชำระเงิน (กรณีเก็บเงินปลายทาง - COD)',
  'ไม่สามารถติดต่อลูกค้าได้ ณ จุดส่งของ',
  'สินค้าชำรุดเสียหายจากทางร้านค้า',
  'สินค้าที่สั่งหมด / ร้านค้าปิด / หาของไม่ได้',
  'เกิดอุบัติเหตุ / เหตุสุดวิสัยระหว่างนำส่ง',
  'อื่นๆ (ระบุรายละเอียดเพิ่มเติม)',
];

const REQUESTER_DISPUTE_REASONS = [
  'ไม่ได้รับสินค้า / ไรเดอร์ไม่มาส่งตามเวลา',
  'สินค้าแตกหัก / เสียหายจากการขนส่ง (ขอเคลม)',
  'สินค้าไม่ถูกต้อง / ได้รับของไม่ครบตามรายการ',
  'สินค้าหมดอายุ / เสื่อมสภาพ / มีปัญหาจากร้านค้า',
  'ไรเดอร์เรียกเก็บเงินเกินจำนวนจริง',
  'พฤติกรรมไรเดอร์ไม่เหมาะสม / ไม่สุภาพ',
  'อื่นๆ (ระบุรายละเอียดเพิ่มเติม)',
];

interface ProofItem {
  id: number;
  image_url: string;
  verify_status?: string;
  uploaded_at: string;
}

interface OrderDetail {
  id: number;
  status: string;
  payment_mode: 'wallet' | 'cod';
  item_total: number;
  fee: number;
  requester_id: string;
  runner_id: string | null;
  otherPartyName: string;
  otherPartyAvatar: string | null;
  otherPartyTrust: number;
  items: { item_name: string; quantity: number }[];
  dropoffLabel: string | null;
  storeLat: number | null;
  storeLng: number | null;
  storeLabel: string | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  created_at?: string;
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string | undefined;
  const viewMode = params.mode as string | undefined;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 📸 State สำหรับรูปภาพหลักฐาน
  const [proofs, setProofs] = useState<ProofItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // 💵 State สำหรับ Modal กรอกราคาสินค้าจริง
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [actualTotalInput, setActualTotalInput] = useState('');

  // 📝 State สำหรับ Modal รายงานปัญหา / ข้อพิพาท
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [disputeDetail, setDisputeDetail] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const loadProofs = useCallback(async () => {
    if (!orderId) return;
    const { data, error } = await supabase
      .from('proof_of_purchases')
      .select('id, image_url, verify_status, uploaded_at')
      .eq('order_id', Number(orderId))
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.log('loadProofs error:', error.message);
      return;
    }

    if (data) {
      setProofs(data as ProofItem[]);
    }
  }, [orderId]);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      setLoadError('ไม่พบรหัสออเดอร์');
      setOrder(null);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setMyUserId(uid);

      // 1. ดึงข้อมูลออเดอร์
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(
          `id, status, payment_mode, item_total, fee, requester_id, runner_id, post_id, store_id, dropoff_id, created_at,
           custom_store_lat, custom_store_lng, custom_store_label,
           custom_dropoff_lat, custom_dropoff_lng, custom_dropoff_label,
           order_items ( item_name, quantity )`
        )
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('ไม่พบออเดอร์นี้');

      const row = orderData as any;
      const reqId = row.requester_id ? String(row.requester_id).trim() : '';
      const runId = row.runner_id ? String(row.runner_id).trim() : null;

      let resolvedStoreName: string | null = null;
      let resolvedStoreLat: number | null = null;
      let resolvedStoreLng: number | null = null;

      // กรองค่า custom_store_label ถ้าไม่ใช่คำว่า "ร้านค้า"
      if (row.custom_store_label && row.custom_store_label.trim() !== 'ร้านค้า') {
        resolvedStoreName = row.custom_store_label.trim();
        resolvedStoreLat = row.custom_store_lat ? Number(row.custom_store_lat) : null;
        resolvedStoreLng = row.custom_store_lng ? Number(row.custom_store_lng) : null;
      }

      // 2. ถ้ายังไม่ได้ชื่อร้าน และมี store_id ใน orders ให้ดึงจากตาราง stores ตรงๆ
      if (!resolvedStoreName && row.store_id) {
        const { data: sData } = await supabase
          .from('stores')
          .select('name, lat, lng')
          .eq('id', row.store_id)
          .single();

        if (sData) {
          resolvedStoreName = sData.name;
          resolvedStoreLat = sData.lat ? Number(sData.lat) : resolvedStoreLat;
          resolvedStoreLng = sData.lng ? Number(sData.lng) : resolvedStoreLng;
        }
      }

      // 3. ถ้ายังไม่ได้ชื่อร้าน ให้ดึงจาก runner_posts ผ่าน post_id
      if (!resolvedStoreName && row.post_id) {
        const { data: postData } = await supabase
          .from('runner_posts')
          .select('store_id, custom_origin_label, custom_origin_lat, custom_origin_lng')
          .eq('id', row.post_id)
          .single();

        if (postData) {
          if (postData.custom_origin_label && postData.custom_origin_label.trim() !== 'ร้านค้า') {
            resolvedStoreName = postData.custom_origin_label.trim();
            resolvedStoreLat = postData.custom_origin_lat ? Number(postData.custom_origin_lat) : resolvedStoreLat;
            resolvedStoreLng = postData.custom_origin_lng ? Number(postData.custom_origin_lng) : resolvedStoreLng;
          } else if (postData.store_id) {
            const { data: pStoreData } = await supabase
              .from('stores')
              .select('name, lat, lng')
              .eq('id', postData.store_id)
              .single();

            if (pStoreData) {
              resolvedStoreName = pStoreData.name;
              resolvedStoreLat = pStoreData.lat ? Number(pStoreData.lat) : resolvedStoreLat;
              resolvedStoreLng = pStoreData.lng ? Number(pStoreData.lng) : resolvedStoreLng;
            }
          }
        }
      }

      // 4. ดึงข้อมูลจุดส่งปลายทาง (Dropoff)
      let resolvedDropoffName: string | null = row.custom_dropoff_label || null;
      let resolvedDropoffLat: number | null = row.custom_dropoff_lat ? Number(row.custom_dropoff_lat) : null;
      let resolvedDropoffLng: number | null = row.custom_dropoff_lng ? Number(row.custom_dropoff_lng) : null;

      if (row.dropoff_id) {
        const { data: dData } = await supabase
          .from('dropoff_locations')
          .select('name, lat, lng')
          .eq('id', row.dropoff_id)
          .single();

        if (dData) {
          resolvedDropoffName = dData.name;
          resolvedDropoffLat = dData.lat ? Number(dData.lat) : resolvedDropoffLat;
          resolvedDropoffLng = dData.lng ? Number(dData.lng) : resolvedDropoffLng;
        }
      }

      // 5. ดึงข้อมูลโปรไฟล์คู่สนทนา
      const isRunnerUser = uid && runId && String(uid).trim() === runId;
      const otherUserId = isRunnerUser ? reqId : runId;
      let otherName = 'ไม่ทราบชื่อ';
      let otherAvatar: string | null = null;
      let otherTrust = 100;

      if (otherUserId) {
        const { data: otherUser } = await supabase
          .from('users')
          .select('name, avatar_url, trust_scores(trust_score)')
          .eq('id', otherUserId)
          .single();
        if (otherUser) {
          otherName = otherUser.name || 'ไม่ทราบชื่อ';
          otherAvatar = otherUser.avatar_url || null;
          otherTrust = (otherUser as any).trust_scores?.[0]?.trust_score ?? 100;
        }
      }

      setOrder({
        id: row.id,
        status: row.status,
        payment_mode: row.payment_mode,
        item_total: Number(row.item_total),
        fee: Number(row.fee),
        requester_id: reqId,
        runner_id: runId,
        otherPartyName: otherName,
        otherPartyAvatar: otherAvatar,
        otherPartyTrust: otherTrust,
        items: row.order_items || [],
        dropoffLabel: resolvedDropoffName || 'จุดส่งของ',
        dropoffLat: resolvedDropoffLat,
        dropoffLng: resolvedDropoffLng,
        storeLabel: resolvedStoreName || 'ไม่ได้ระบุชื่อร้านค้า',
        storeLat: resolvedStoreLat,
        storeLng: resolvedStoreLng,
        created_at: row.created_at,
      } as any);

      await loadProofs();
    } catch (error: any) {
      console.log('loadOrder error', error);
      setLoadError(error.message || 'ไม่สามารถโหลดข้อมูลออเดอร์ได้');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, loadProofs]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder])
  );

  const uidStr = myUserId ? String(myUserId).trim() : '';
  const reqIdStr = order?.requester_id ? String(order.requester_id).trim() : '';
  const runIdStr = order?.runner_id ? String(order.runner_id).trim() : '';

  const isRunner = viewMode === 'runner' || (Boolean(uidStr && runIdStr && uidStr === runIdStr) && uidStr !== reqIdStr);
  const isRequester = !isRunner;

  // 🛵 ระบบส่ง GPS สดอัตโนมัติฝั่ง Runner
  useEffect(() => {
    if (!isRunner || order?.status !== 'delivering' || !order?.id) return;

    let sub: Location.LocationSubscription | null = null;

    const startLocationUpdates = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 4000,
          distanceInterval: 5,
        },
        async (loc) => {
          await supabase.from('runner_locations').upsert(
            {
              order_id: Number(order.id),
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'order_id' }
          );
        }
      );
    };

    startLocationUpdates();

    return () => {
      if (sub) sub.remove();
    };
  }, [isRunner, order?.status, order?.id]);

  // 📸 ฟังก์ชันถ่ายรูป / อัปโหลดหลักฐานส่งของแบบ Base64
  const handlePickAndUploadProof = async () => {
    if (!order) return;

    Alert.alert('หลักฐานการจัดส่งสินค้า', 'เลือกวิธีการอัปโหลดภาพ', [
      {
        text: 'ถ่ายภาพด้วยกล้อง',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('ต้องขออนุญาต', 'กรุณายินยอมให้เข้าถึงกล้องถ่ายภาพ');
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.6,
            base64: true,
          });
          if (!res.canceled && res.assets[0]?.uri) {
            uploadProofImage(res.assets[0].uri, res.assets[0].base64);
          }
        },
      },
      {
        text: 'เลือกจากคลังรูปภาพ',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.6,
            base64: true,
          });
          if (!res.canceled && res.assets[0]?.uri) {
            uploadProofImage(res.assets[0].uri, res.assets[0].base64);
          }
        },
      },
      { text: 'ยกเลิก', style: 'cancel' },
    ]);
  };

  const uploadProofImage = async (uri: string, base64Data?: string | null) => {
    if (!order) return;
    setUploadingImage(true);

    try {
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `proof_${order.id}_${Date.now()}.${fileExt}`;
      const contentType = `image/${fileExt === 'png' ? 'png' : 'jpeg'}`;

      if (!base64Data) {
        throw new Error('ไม่พบข้อมูลภาพ Base64');
      }

      const { error: uploadError } = await supabase.storage
        .from('proof_images')
        .upload(fileName, decode(base64Data), {
          contentType,
          upsert: true,
        });

      if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage
        .from('proof_images')
        .getPublicUrl(fileName);

      const finalUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase
        .from('proof_of_purchases')
        .insert({
          order_id: Number(order.id),
          image_url: finalUrl,
          verify_status: 'pending',
          uploaded_at: new Date().toISOString(),
        });

      if (insertError) throw new Error(`Database Error: ${insertError.message}`);

      Alert.alert('สำเร็จ', 'บันทึกหลักฐานการจัดส่งเรียบร้อยแล้ว');
      await loadProofs();
    } catch (err: any) {
      Alert.alert('อัปโหลดไม่สำเร็จ', err.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setUploadingImage(false);
    }
  };

  // 💵 ฟังก์ชันอัปเดตราคาสินค้าจริง
  const handleUpdateActualItemTotal = async () => {
    const newTotal = parseFloat(actualTotalInput);
    if (isNaN(newTotal) || newTotal < 0) {
      Alert.alert('กรุณากรอกราคาให้ถูกต้อง');
      return;
    }

    if (!order) return;

    const { error } = await supabase
      .from('orders')
      .update({ item_total: newTotal })
      .eq('id', order.id);

    if (error) {
      Alert.alert('อัปเดตไม่สำเร็จ', error.message);
      return;
    }

    setOrder(prev => prev ? { ...prev, item_total: newTotal } : null);
    setPriceModalVisible(false);
    Alert.alert('สำเร็จ', `อัปเดตราคาสินค้าจริงเป็น ฿${newTotal.toFixed(0)} เรียบร้อย`);
  };

  const currentStepIndex = order ? STEP_ORDER.indexOf(order.status) : -1;

  const openNavigation = (lat: number | null, lng: number | null, label: string | null) => {
    if (!lat || !lng) {
      Alert.alert('ไม่พบพิกัด', 'สถานที่นี้ไม่ได้ระบุพิกัดบนแผนที่ไว้');
      return;
    }

    const encodedLabel = encodeURIComponent(label || 'จุดหมาย');
    const scheme = Platform.OS === 'ios' ? 'maps:' : 'geo:';
    const url = Platform.select({
      ios: `${scheme}0,0?q=${encodedLabel}@${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
    });

    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    Linking.canOpenURL(url!)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url!);
        } else {
          Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Linking.openURL(webUrl);
      });
  };

  const updateStatus = async (newStatus: string) => {
    if (!order || updating) return;

    if (!canTransitionTo(order.status, newStatus)) {
      Alert.alert('สถานะไม่ถูกต้อง', 'ไม่สามารถอัปเดตสถานะนี้จากสถานะปัจจุบันได้');
      return;
    }

    setUpdating(true);

    try {
      if (newStatus === 'completed' && order.payment_mode === 'wallet') {
        const { error } = await supabase.rpc('release_escrow_and_complete', { p_order_id: order.id });
        if (error) throw error;
      } else {
        const updatePayload: any = { status: newStatus };
        if (newStatus === 'completed') {
          updatePayload.completed_at = new Date().toISOString();
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update(updatePayload)
          .eq('id', order.id);

        if (updateError) throw updateError;

        const { error: logError } = await supabase.from('order_status_logs').insert({
          order_id: order.id,
          changed_by: myUserId,
          status: newStatus,
          note: `เปลี่ยนสถานะเป็น ${STEP_LABELS[newStatus] || newStatus}`,
        });

        if (logError) throw logError;
      }

      await loadOrder();
    } catch (error: any) {
      Alert.alert('อัปเดตสถานะไม่สำเร็จ', error.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmCOD = async () => {
    if (!order || updating) return;
    setUpdating(true);

    try {
      const { error: rpcError } = await supabase.rpc('settle_cod_order', {
        p_order_id: order.id,
        p_changed_by: myUserId,
      });

      if (rpcError) throw rpcError;

      Alert.alert('สำเร็จ', 'ยืนยันรับเงินและจบงานเรียบร้อยแล้ว');
      router.replace('/(runner-tabs)');
    } catch (error: any) {
      Alert.alert('ผิดพลาด', error.message || 'ไม่สามารถยืนยันยอดเงินได้');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || updating) return;
    Alert.alert('ยืนยัน', 'คุณต้องการยกเลิกคำขอฝากหิ้วนี้ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        style: 'destructive',
        onPress: async () => {
          setUpdating(true);
          try {
            const { error: updateError } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
            if (updateError) throw updateError;

            const { error: logError } = await supabase.from('order_status_logs').insert({
              order_id: order.id,
              changed_by: myUserId,
              status: 'cancelled',
              note: 'ผู้ใช้ยกเลิกออเดอร์',
            });
            if (logError) throw logError;

            Alert.alert('สำเร็จ', 'ยกเลิกออเดอร์เรียบร้อยแล้ว');
            router.back();
          } catch (error: any) {
            Alert.alert('ยกเลิกไม่สำเร็จ', error.message || 'กรุณาลองใหม่อีกครั้ง');
          } finally {
            setUpdating(false);
          }
        },
      },
    ]);
  };

  const submitDisputeReport = async () => {
    if (!order || !selectedReason) {
      Alert.alert('กรุณาเลือกสาเหตุ', 'โปรดเลือกหัวข้อปัญหาที่ท่านพบ');
      return;
    }

    setSubmittingDispute(true);
    const combinedReason = `${selectedReason}: ${disputeDetail.trim() || 'ไม่ได้ระบุรายละเอียดเพิ่มเติม'}`;

    try {
      const { error: disputeError } = await supabase
        .from('dispute_reports')
        .insert({
          reporter_id: myUserId,
          target_type: 'order',
          target_id: Number(order.id),
          reason: combinedReason,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (disputeError) throw disputeError;

      await supabase.from('orders').update({ status: 'disputed' }).eq('id', order.id);
      await supabase.from('order_status_logs').insert({
        order_id: order.id,
        changed_by: myUserId,
        status: 'disputed',
        note: `รายงานปัญหา: ${combinedReason}`,
      });

      setDisputeModalVisible(false);
      setSelectedReason('');
      setDisputeDetail('');

      Alert.alert('ส่งรายงานเรียบร้อย', 'ทางระบบได้รับคำร้องแล้ว แอดมินจะดำเนินการตรวจสอบข้อมูลและแจ้งผลให้ทราบครับ');
      await loadOrder();
    } catch (error: any) {
      Alert.alert('ส่งรายงานไม่สำเร็จ', error.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmittingDispute(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#FF7A30" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <Text style={styles.emptyTitle}>ไม่พบออเดอร์</Text>
        <Text style={styles.emptyText}>{loadError || 'ข้อมูลออเดอร์อาจถูกลบหรือหมดอายุแล้ว'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => loadOrder()}>
          <Text style={styles.retryText}>ลองโหลดใหม่</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const disputeReasons = isRunner ? RUNNER_DISPUTE_REASONS : REQUESTER_DISPUTE_REASONS;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader title="อัปเดตสถานะ" subtitle={`Order #${order.id}`} />

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>คำสั่งซื้อ #{order.id}</Text>
              <Text style={styles.heroSubtitle}>{order.storeLabel} → {order.dropoffLabel}</Text>
            </View>
            <StatusPill status={order.status} />
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaBox}>
              <Text style={styles.heroMetaLabel}>วิธีชำระ</Text>
              <Text style={styles.heroMetaValue}>{order.payment_mode === 'cod' ? 'COD' : 'Wallet'}</Text>
            </View>
            <View style={styles.heroMetaBox}>
              <Text style={styles.heroMetaLabel}>ยอดรวม</Text>
              <Text style={styles.heroMetaValue}>฿{(order.item_total + order.fee).toFixed(0)}</Text>
            </View>
            <View style={styles.heroMetaBox}>
              <Text style={styles.heroMetaLabel}>สร้างเมื่อ</Text>
              <Text style={styles.heroMetaValue}>{formatDisplayDate((order as any).created_at)}</Text>
            </View>
          </View>
        </View>

        {/* ⚠️ แถบแจ้งเตือนเมื่อออเดอร์อยู่ในสถานะ Disputed */}
        {order.status === 'disputed' && (
          <View style={styles.disputedBanner}>
            <Ionicons name="alert-circle" size={24} color="#D9534F" />
            <View style={{ flex: 1 }}>
              <Text style={styles.disputedBannerTitle}>ออเดอร์นี้อยู่ระหว่างตรวจสอบข้อพิพาท</Text>
              <Text style={styles.disputedBannerText}>ระบบกำลังระงับคำสั่งซื้อชั่วคราวเพื่อให้แอดมินดำเนินการตรวจสอบข้อมูล</Text>
            </View>
          </View>
        )}

        {/* Timeline */}
        {order.status !== 'disputed' && (
          <View style={styles.timeline}>
            {STEP_ORDER.map((step, index) => {
              const completed = currentStepIndex > index;
              const current = currentStepIndex === index;
              return (
                <View key={step} style={styles.timelineItem}>
                  <View style={[styles.timelineCircle, (completed || current) && styles.timelineCircleCompleted]}>
                    {completed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  {index < STEP_ORDER.length - 1 && (
                    <View style={[styles.timelineLine, completed && styles.timelineLineCompleted]} />
                  )}
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineLabel, (completed || current) && styles.timelineLabelCompleted]}>
                      {STEP_LABELS[step]}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 📡 1. มุมมองฝั่งคนฝากหิ้ว (REQUESTER) */}
        {isRequester && order.status !== 'disputed' && (
          <View style={{ marginVertical: 4 }}>
            {order.status === 'delivering' && (
              <LiveTrackingCard
                orderId={order.id}
                dropoffLat={order.dropoffLat ?? 0}
                dropoffLng={order.dropoffLng ?? 0}
              />
            )}

            {order.status === 'completed' && proofs.length > 0 && (
              <TouchableOpacity 
                style={styles.proofFullButton}
                onPress={() => setViewingImage(proofs[0].image_url)}
              >
                <Ionicons name="images" size={18} color="#FFFFFF" />
                <Text style={styles.proofFullButtonText}>หลักฐานการจัดส่งสินค้า</Text>
              </TouchableOpacity>
            )}

            {order.status === 'pending' && (
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelOrder} disabled={updating}>
                <Text style={styles.cancelBtnText}>ยกเลิกออเดอร์นี้</Text>
              </TouchableOpacity>
            )}

            {order.status === 'completed' && (
              <TouchableOpacity style={styles.rateBtn} onPress={() => router.push({ pathname: '/rate-rider', params: { orderId: order.id, runnerId: order.runner_id || '' } })}>
                <Ionicons name="star" size={18} color="#FFFFFF" />
                <Text style={styles.rateBtnText}>ให้คะแนนผู้รับหิ้ว</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 🛵 2. มุมมองฝั่งคนรับหิ้ว (RUNNER) */}
        {isRunner && order.status !== 'disputed' && (
          <View style={{ marginVertical: 4 }}>
            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <View style={styles.navSection}>
                <Text style={styles.navSectionTitle}>ศูนย์นำทาง (GPS Navigation)</Text>
                <View style={styles.navButtonRow}>
                  <TouchableOpacity
                    style={[styles.navBtn, { backgroundColor: '#FF7A30' }]}
                    onPress={() => openNavigation(order.storeLat, order.storeLng, order.storeLabel)}
                  >
                    <Ionicons name="cart" size={18} color="#FFFFFF" />
                    <Text style={styles.navBtnText}>ไปร้านค้า</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.navBtn, { backgroundColor: '#2ECC71' }]}
                    onPress={() => openNavigation(order.dropoffLat, order.dropoffLng, order.dropoffLabel)}
                  >
                    <Ionicons name="navigate" size={18} color="#FFFFFF" />
                    <Text style={styles.navBtnText}>ไปจุดส่งของ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 📸 ปุ่มเดี่ยว: "หลักฐานการจัดส่งสินค้า" */}
            {order.status === 'delivering' && (
              <View style={styles.runnerProofBox}>
                {proofs.length === 0 ? (
                  <TouchableOpacity 
                    style={styles.runnerProofBtn} 
                    onPress={handlePickAndUploadProof}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <ActivityIndicator size="small" color="#FF7A30" />
                    ) : (
                      <>
                        <Ionicons name="camera" size={18} color="#FF7A30" />
                        <Text style={styles.runnerProofBtnText}>หลักฐานการจัดส่งสินค้า</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={{ alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity onPress={() => setViewingImage(proofs[0].image_url)}>
                      <Image 
                        source={{ uri: proofs[0].image_url }} 
                        style={{ width: 140, height: 140, borderRadius: 14, borderWidth: 1, borderColor: '#FF7A30' }} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.runnerProofBtn, { paddingVertical: 8, paddingHorizontal: 16 }]} 
                      onPress={handlePickAndUploadProof}
                      disabled={uploadingImage}
                    >
                      <Ionicons name="camera-reverse" size={16} color="#FF7A30" />
                      <Text style={[styles.runnerProofBtnText, { fontSize: 13 }]}>ถ่ายรูปใหม่</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ปุ่มชำระเงิน COD */}
            {order.payment_mode === 'cod' && order.status === 'delivering' && (
              <View style={styles.codSection}>
                <View style={styles.codHeader}>
                  <Ionicons name="cash" size={20} color="#4A90E2" />
                  <Text style={styles.codTitle}>COD Cash Settlement</Text>
                </View>
                <View style={styles.codAmount}>
                  <Text style={styles.codLabel}>ยอดที่ต้องรับ</Text>
                  <Text style={styles.codValue}>฿{(order.item_total + order.fee).toFixed(0)}</Text>
                </View>
                <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmCOD} disabled={updating}>
                  {updating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmButtonText}>ยืนยันการรับเงิน</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Items Card */}
        <View style={styles.itemsCard}>
          {!!order.storeLabel && (
            <View style={[styles.dropoffRow, { backgroundColor: '#FFF3EB' }]}>
              <Ionicons name="cart" size={14} color="#FF7A30" />
              <Text style={styles.dropoffText}>ร้านค้า: {order.storeLabel}</Text>
            </View>
          )}
          {!!order.dropoffLabel && (
            <View style={styles.dropoffRow}>
              <Ionicons name="location" size={14} color="#FF7A30" />
              <Text style={styles.dropoffText}>ส่งที่: {order.dropoffLabel}</Text>
            </View>
          )}
          
          <Text style={styles.itemsTitle}>รายการสินค้า</Text>
          {order.items.map((it, i) => (
            <Text key={i} style={styles.itemLine}>• {it.item_name} ×{it.quantity}</Text>
          ))}
          
          <View style={styles.divider} />
          
          {/* ช่องแสดง/แก้ไขราคาสินค้าจริง */}
          <View style={styles.itemsTotalRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.itemsTotalLabel}>ค่าสินค้าจริง</Text>
              {isRunner && order.status !== 'completed' && (
                <TouchableOpacity 
                  onPress={() => {
                    setActualTotalInput(String(order.item_total));
                    setPriceModalVisible(true);
                  }}
                  style={styles.editPriceChip}
                >
                  <Ionicons name="pencil" size={12} color="#FF7A30" />
                  <Text style={styles.editPriceChipText}>แก้ไข</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.itemsTotalValue, { color: '#3A2113', fontSize: 16 }]}>฿{order.item_total.toFixed(0)}</Text>
          </View>

          <View style={[styles.itemsTotalRow, { marginTop: 4 }]}>
            <Text style={styles.itemsTotalLabel}>ค่าหิ้ว</Text>
            <Text style={[styles.itemsTotalValue, { color: '#3A2113', fontSize: 16 }]}>฿{order.fee.toFixed(0)}</Text>
          </View>

          <View style={[styles.itemsTotalRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#F5EBE1' }]}>
            <Text style={[styles.itemsTotalLabel, { fontWeight: 'bold', color: '#3A2113' }]}>ยอดรวมสุทธิ</Text>
            <Text style={styles.itemsTotalValue}>฿{(order.item_total + order.fee).toFixed(0)}</Text>
          </View>
        </View>

        {/* ปุ่มเลื่อนสถานะงานสำหรับ Runner (เปิดให้กดได้ทุกสถานะจนจบงาน) */}
        {isRunner && 
        order.status !== 'disputed' && 
        currentStepIndex >= 0 && 
        currentStepIndex < STEP_ORDER.length - 1 && 
        !(order.payment_mode === 'cod' && order.status === 'delivering') && (
          <TouchableOpacity 
            style={styles.advanceBtn} 
            onPress={() => updateStatus(STEP_ORDER[currentStepIndex + 1])} 
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.advanceBtnText}>
                อัปเดตเป็น: {STEP_LABELS[STEP_ORDER[currentStepIndex + 1]]}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* QR Code (Wallet mode) */}
        {order.payment_mode === 'wallet' && order.status !== 'disputed' && (
          <View style={styles.qrSection}>
            {isRunner ? (
              <View style={styles.qrContainer}>
                <View style={styles.qrBox}>
                  <QRCode value={`CARRYBUDDY-ORDER-${order.id}`} size={140} color="#3A2113" backgroundColor="#FFFFFF" />
                </View>
                <Text style={styles.qrLabel}>QR สำหรับให้ลูกค้าสแกนรับของ (Order #{order.id})</Text>
                <Text style={styles.qrHintText}>ให้ลูกค้าสแกน QR นี้เมื่อนำส่งสินค้าถึงมือเพื่อจบงาน</Text>
              </View>
            ) : (
              <View style={styles.qrContainer}>
                <Text style={styles.qrLabel}>ยืนยันการรับสินค้า</Text>
                <TouchableOpacity
                  style={styles.regenerateButton}
                  onPress={() => router.push({ pathname: '/qr-scanner', params: { orderId: order.id } })}
                >
                  <Ionicons name="camera" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.regenerateButtonText}>เปิดกล้องสแกน QR ของไรเดอร์</Text>
                </TouchableOpacity>
                <Text style={styles.qrHintText}>เมื่อได้รับสินค้าแล้ว กดปุ่มนี้เพื่อส่อง QR Code ของไรเดอร์</Text>
              </View>
            )}
          </View>
        )}

        {/* Other party Info */}
        <View style={styles.riderSection}>
          <View style={styles.riderCard}>
            {order.otherPartyAvatar ? (
              <Image source={{ uri: order.otherPartyAvatar }} style={styles.riderAvatarImage} />
            ) : (
              <View style={[styles.riderAvatar, { backgroundColor: '#4A90E2' }]}>
                <Text style={styles.riderAvatarText}>{order.otherPartyName.slice(0, 2)}</Text>
              </View>
            )}
            <View style={styles.riderInfo}>
              <Text style={styles.riderName}>{order.otherPartyName}</Text>
              <Text style={styles.riderTrust}>Trust {order.otherPartyTrust}</Text>
            </View>
            <TouchableOpacity
              style={styles.messageButton}
              onPress={async () => {
                const otherPartyId = isRunner ? order.requester_id : order.runner_id;
                if (!otherPartyId) {
                  Alert.alert('เปิดแชทไม่สำเร็จ', 'ไม่พบข้อมูลคู่สนทนาของออเดอร์นี้');
                  return;
                }

                const { data: conversationId, error } = await supabase.rpc('get_or_create_conversation', {
                  other_user_id: otherPartyId,
                });
                if (error || !conversationId) {
                  Alert.alert('เปิดแชทไม่สำเร็จ', error?.message ?? 'กรุณาลองใหม่อีกครั้ง');
                  return;
                }
                router.push({ pathname: '/chat-detail/[id]', params: { id: String(conversationId) } });
              }}
            >
              <Ionicons name="chatbubble" size={20} color="#FF7A30" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 🚨 ปุ่มเดี่ยว "รายงานปัญหา" */}
        {order.status !== 'disputed' && order.status !== 'cancelled' && (
          <TouchableOpacity 
            style={styles.singleReportBtn} 
            onPress={() => {
              setSelectedReason('');
              setDisputeDetail('');
              setDisputeModalVisible(true);
            }}
          >
            <Ionicons name="warning-outline" size={16} color="#E74C3C" />
            <Text style={styles.singleReportBtnText}>รายงานปัญหา</Text>
          </TouchableOpacity>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* 💵 Modal แก้ไขราคาสินค้าจริง (เพิ่ม KeyboardAvoidingView + ปรับให้ลอยพ้นคีย์บอร์ด) */}
      <Modal visible={priceModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlayCenter}
        >
          <View style={styles.priceModalContent}>
            <Text style={styles.modalTitle}>ระบุราคาสินค้ารวมจริง</Text>
            <Text style={styles.modalSubtitle}>กรอกราคาสินค้าที่ซื้อมาจริงตามใบเสร็จ</Text>
            <TextInput
              style={[styles.modalInput, { fontSize: 22, textAlign: 'center', fontWeight: 'bold', minHeight: 52 }]}
              keyboardType="numeric"
              value={actualTotalInput}
              onChangeText={setActualTotalInput}
              placeholder="0.00"
              autoFocus={true}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPriceModalVisible(false)}>
                <Text style={styles.modalCancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#FF7A30' }]} onPress={handleUpdateActualItemTotal}>
                <Text style={styles.modalSubmitText}>บันทึกราคา</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🖼️ Modal แสดงภาพหลักฐานขนาดใหญ่ */}
      <Modal visible={!!viewingImage} transparent={true} animationType="fade">
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity style={styles.closeImageBtn} onPress={() => setViewingImage(null)}>
            <Ionicons name="close-circle" size={34} color="#FFFFFF" />
          </TouchableOpacity>
          {viewingImage && (
            <Image source={{ uri: viewingImage }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* 🛑 Modal รวมหัวข้อการรายงานปัญหา (ใส่ keyboardVerticalOffset ให้เลื่อนหลบคีย์บอร์ด) */}
      <Modal
        visible={disputeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDisputeModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle" size={22} color="#E74C3C" />
                <Text style={styles.modalTitle}>รายงานปัญหาออเดอร์</Text>
              </View>
              <TouchableOpacity onPress={() => setDisputeModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8B7E74" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
              <Text style={styles.modalSubtitle}>เลือกหัวข้อปัญหาที่พบ:</Text>
              {disputeReasons.map((reason, index) => {
                const isSelected = selectedReason === reason;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                    onPress={() => setSelectedReason(reason)}
                  >
                    <Ionicons 
                      name={isSelected ? "radio-button-on" : "radio-button-off"} 
                      size={18} 
                      color={isSelected ? "#FF7A30" : "#B0A498"} 
                    />
                    <Text style={[styles.reasonOptionText, isSelected && styles.reasonOptionTextSelected]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.modalSubtitle, { marginTop: 14 }]}>รายละเอียดเพิ่มเติม (ถ้ามี):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="พิมพ์รายละเอียดเพิ่มเติม..."
                placeholderTextColor="#B0A498"
                multiline
                numberOfLines={3}
                value={disputeDetail}
                onChangeText={setDisputeDetail}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setDisputeModalVisible(false)}
                disabled={submittingDispute}
              >
                <Text style={styles.modalCancelText}>ยกเลิก</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalSubmitBtn, !selectedReason && { opacity: 0.6 }]} 
                onPress={submitDisputeReport}
                disabled={submittingDispute || !selectedReason}
              >
                {submittingDispute ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>ส่งเรื่องให้แอดมิน</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const trackingStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F5EBE1',
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: 'column',
  },
  waitingText: { fontSize: 13, color: '#8B7E74', marginLeft: 8, lineHeight: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F8F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 6 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC71' },
  liveText: { fontSize: 11, fontWeight: 'bold', color: '#2ECC71' },
  distanceText: { fontSize: 12, fontWeight: '600', color: '#8B7E74' },
  etaContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF3EB', padding: 12, borderRadius: 12 },
  etaTitle: { fontSize: 12, color: '#8B7E74' },
  etaValue: { fontSize: 16, fontWeight: 'bold', color: '#FF7A30' },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ORDER_THEME.backgroundAlt
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ORDER_THEME.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: ORDER_THEME.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: ORDER_THEME.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryText: {
    color: ORDER_THEME.surface,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: ORDER_THEME.surface,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: ORDER_THEME.borderSoft,
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ORDER_THEME.textPrimary,
  },
  heroSubtitle: {
    fontSize: 12,
    color: ORDER_THEME.textSecondary,
    marginTop: 4,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroMetaBox: {
    flex: 1,
    minWidth: 90,
    backgroundColor: ORDER_THEME.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  heroMetaLabel: {
    fontSize: 10,
    color: ORDER_THEME.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  heroMetaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: ORDER_THEME.textPrimary,
  },
  disputedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FDEDEC',
    borderWidth: 1,
    borderColor: '#F5B7B1',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 14,
    borderRadius: 14,
  },
  disputedBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D9534F',
    marginBottom: 2,
  },
  disputedBannerText: {
    fontSize: 12,
    color: '#78281F',
    lineHeight: 16,
  },
  timeline: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 50
  },
  timelineCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ORDER_THEME.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    marginTop: 2,
    zIndex: 2,
  },
  timelineCircleCompleted: {
    backgroundColor: '#FF7A30'
  },
  timelineLine: {
    width: 3,
    position: 'absolute',
    left: 10,
    top: 26,
    bottom: -10,
    backgroundColor: ORDER_THEME.borderSoft,
    zIndex: 1
  },
  timelineLineCompleted: {
    backgroundColor: '#FF7A30'
  },
  timelineContent: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 16
  },
  timelineLabel: {
    fontSize: 14,
    color: ORDER_THEME.textMuted,
    fontWeight: '500'
  },
  timelineLabelCompleted: {
    color: '#3A2113',
    fontWeight: '600',
    fontSize: 15
  },
  navSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: ORDER_THEME.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: ORDER_THEME.borderSoft,
    elevation: 1,
  },
  navSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#3A2113',
    marginBottom: 10,
  },
  navButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  navBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  runnerProofBox: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  runnerProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#FFF3EB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD7C2',
  },
  runnerProofBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF7A30',
  },
  proofFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#2ECC71',
    borderRadius: 14,
    paddingVertical: 16,
    elevation: 2,
  },
  proofFullButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  itemsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F5EBE1',
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3A2113',
    marginBottom: 10,
    letterSpacing: 0.3
  },
  dropoffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF3EB',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8
  },
  dropoffText: {
    fontSize: 13,
    color: '#FF7A30',
    fontWeight: '600'
  },
  itemLine: {
    fontSize: 14,
    color: '#5C4638',
    paddingVertical: 4
  },
  divider: {
    height: 1,
    backgroundColor: ORDER_THEME.borderSoft,
    marginVertical: 12
  },
  itemsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  itemsTotalLabel: {
    fontSize: 14,
    color: ORDER_THEME.textSecondary
  },
  itemsTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ORDER_THEME.accent
  },
  editPriceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFF3EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFE0C7',
  },
  editPriceChipText: {
    fontSize: 11,
    color: '#FF7A30',
    fontWeight: 'bold',
  },
  advanceBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: ORDER_THEME.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: ORDER_THEME.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  advanceBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16
  },
  cancelBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: ORDER_THEME.danger,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: ORDER_THEME.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16
  },
  singleReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F5B7B1',
    borderRadius: 12,
  },
  singleReportBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E74C3C',
  },
  qrSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 12
  },
  qrContainer: {
    backgroundColor: ORDER_THEME.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: ORDER_THEME.borderSoft,
    alignItems: 'center',
    gap: 12
  },
  qrBox: {
    padding: 12,
    backgroundColor: ORDER_THEME.backgroundAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ORDER_THEME.border
  },
  qrLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C4638'
  },
  qrHintText: {
    fontSize: 12,
    color: ORDER_THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 18
  },
  regenerateButton: {
    backgroundColor: '#FF7A30',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  regenerateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  codSection: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: ORDER_THEME.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: ORDER_THEME.infoSoft
  },
  codHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  codTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50'
  },
  codAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  codLabel: {
    fontSize: 14,
    color: '#7F8C8D'
  },
  codValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2ECC71'
  },
  confirmButton: {
    backgroundColor: ORDER_THEME.success,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  rateBtn: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#FFB84D',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rateBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15
  },
  riderSection: {
    paddingHorizontal: 16,
    marginBottom: 20
  },
  riderCard: {
    backgroundColor: ORDER_THEME.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: ORDER_THEME.borderSoft
  },
  riderAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center'
  },
  riderAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ORDER_THEME.borderSoft,
  },
  riderAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold'
  },
  riderInfo: {
    flex: 1
  },
  riderName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: ORDER_THEME.textPrimary
  },
  riderTrust: {
    fontSize: 12,
    color: ORDER_THEME.textSecondary,
    marginTop: 2
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF3EB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  spacer: {
    height: 40
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  fullImage: {
    width: '92%',
    height: '82%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EBE1',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B7E74',
    marginBottom: 8,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFBF7',
    borderWidth: 1,
    borderColor: '#F5EBE1',
    marginBottom: 6,
  },
  reasonOptionSelected: {
    backgroundColor: '#FFF3EB',
    borderColor: '#FF7A30',
  },
  reasonOptionText: {
    fontSize: 13,
    color: '#5C4638',
    flex: 1,
  },
  reasonOptionTextSelected: {
    color: '#FF7A30',
    fontWeight: 'bold',
  },
  modalInput: {
    backgroundColor: '#FFFBF7',
    borderWidth: 1,
    borderColor: '#EBDCD0',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#3A2113',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5EBE1',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#8B7E74',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  priceModalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
});