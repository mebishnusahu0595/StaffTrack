import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Badge, Button, Card } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import dayjs from "dayjs";
import axios from "axios";
import { api } from "../api/client";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface DispatchTrackingData {
  success: boolean;
  isSubmitted?: boolean;
  isPhotoUploaded?: boolean;
  dispatchPhotoUrl?: string | null;
  photoUploadedAt?: string | null;
  status?: string;
  orderStatus?: string;
  deliveryStatus?: string;
  dispatchId?: string;
  dispatchNo?: string;
  invoiceNo?: string;
  destination?: string;
  despatchedThrough?: string;
  totalAmount?: number;
  totalItems?: number;
  message?: string;
  dealer?: {
    id?: string;
    name?: string;
    garageName?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
  };
  transport?: {
    courierName?: string;
    vehicleNumber?: string;
    driverName?: string;
    driverMobile?: string;
    handoverTo?: string;
  };
  boxes?: {
    scannedCount?: number;
    scannedBoxQrIds?: string[];
  };
  dispatchDate?: string;
  expectedDelivery?: string;
  verifiedBy?: string;
  pdfUrl?: string;
  deliveryStatementUrl?: string;
}

export function VanikiOrderHistoryScreen() {
  const navigation = useNavigation<any>();

  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [dateFilter, setDateFilter] = useState<"TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "ALL">("TODAY");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DISPATCHED" | "PENDING" | "DUE" | "PAID">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Tracking Cache by invoiceNo
  const [trackingMap, setTrackingMap] = useState<Record<string, DispatchTrackingData>>({});
  const [loadingTrackingMap, setLoadingTrackingMap] = useState<Record<string, boolean>>({});

  // Expanded items state
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

  // Full-Screen Image Preview Modal
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedPhotoTitle, setSelectedPhotoTitle] = useState<string>("");

  // Instant Custom Track Input
  const [directInvoiceQuery, setDirectInvoiceQuery] = useState("");
  const [directTrackingResult, setDirectTrackingResult] = useState<DispatchTrackingData | null>(null);
  const [isDirectSearching, setIsDirectSearching] = useState(false);

  useEffect(() => {
    loadOrderHistory();
  }, []);

  const loadOrderHistory = async (isPullToRefresh = false) => {
    try {
      if (isPullToRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const res = await api.get("/vaniki-dealers/activities", {
        params: {
          action: "ORDER_PLACED",
          limit: 150
        }
      });

      const list: any[] = res.data?.data?.activities || res.data?.activities || [];
      setOrders(list);

      // Preload tracking for top 5 recent orders that have invoice numbers
      const topInvoices = list
        .slice(0, 8)
        .map((o) => (o.invoiceNumber || "").trim())
        .filter(Boolean);

      topInvoices.forEach((inv) => {
        fetchTrackingForInvoice(inv);
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to load order history";
      Alert.alert("History Error", msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchTrackingForInvoice = async (invoiceNo: string) => {
    if (!invoiceNo) return;
    const clean = invoiceNo.trim();
    if (trackingMap[clean] || loadingTrackingMap[clean]) return;

    setLoadingTrackingMap((prev) => ({ ...prev, [clean]: true }));
    try {
      const res = await axios.get(
        `https://warehouse.vanikicrop.com/api/dispatches/track/${encodeURIComponent(clean)}`,
        {
          headers: { "Content-Type": "application/json" },
          timeout: 8000
        }
      );
      if (res.data) {
        setTrackingMap((prev) => ({ ...prev, [clean]: res.data }));
      }
    } catch (err) {
      // Not tracked or network error
    } finally {
      setLoadingTrackingMap((prev) => ({ ...prev, [clean]: false }));
    }
  };

  const handleDirectTrack = async () => {
    const q = directInvoiceQuery.trim();
    if (!q) {
      Alert.alert("Input Required", "Please enter an Invoice number (e.g. 273 or B2B-356117421).");
      return;
    }

    try {
      setIsDirectSearching(true);
      const res = await axios.get(
        `https://warehouse.vanikicrop.com/api/dispatches/track/${encodeURIComponent(q)}`,
        {
          headers: { "Content-Type": "application/json" },
          timeout: 8000
        }
      );
      if (res.data) {
        setDirectTrackingResult(res.data);
      } else {
        Alert.alert("Not Found", `No dispatch information found for invoice #${q}`);
      }
    } catch (err: any) {
      Alert.alert("Tracking Notice", `Invoice #${q} is not found in warehouse dispatch system yet.`);
    } finally {
      setIsDirectSearching(false);
    }
  };

  const toggleOrderExpand = (id: string, invoiceNo?: string) => {
    setExpandedOrderIds((prev) => {
      const next = !prev[id];
      if (next && invoiceNo) {
        fetchTrackingForInvoice(invoiceNo);
      }
      return { ...prev, [id]: next };
    });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((ord: any) => {
      // 1. Date filter
      if (ord.createdAt) {
        const ordDate = dayjs(ord.createdAt);
        if (dateFilter === "TODAY") {
          if (!ordDate.isSame(dayjs(), "day")) return false;
        } else if (dateFilter === "YESTERDAY") {
          if (!ordDate.isSame(dayjs().subtract(1, "day"), "day")) return false;
        } else if (dateFilter === "THIS_WEEK") {
          if (!ordDate.isAfter(dayjs().startOf("week"))) return false;
        } else if (dateFilter === "THIS_MONTH") {
          if (!ordDate.isSame(dayjs(), "month")) return false;
        }
      }

      // 2. Status filter
      const outstanding = Number(ord.outstandingAmount || 0);
      const inv = (ord.invoiceNumber || "").trim();
      const track = trackingMap[inv];

      if (statusFilter === "DUE" && outstanding <= 0) return false;
      if (statusFilter === "PAID" && outstanding > 0) return false;
      if (statusFilter === "DISPATCHED" && (!track || !track.isSubmitted)) return false;
      if (statusFilter === "PENDING" && track && track.isSubmitted) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const orderIdMatch = (ord.orderId || ord.id || "").toLowerCase().includes(q);
        const invoiceMatch = (ord.invoiceNumber || "").toLowerCase().includes(q);
        const dealerNameMatch = (ord.dealerName || "").toLowerCase().includes(q);
        const storeMatch = (ord.storeName || "").toLowerCase().includes(q);
        const cityMatch = (ord.dealerCity || "").toLowerCase().includes(q);
        const phoneMatch = (ord.dealerPhone || "").toLowerCase().includes(q);
        const staffMatch = (ord.staffName || "").toLowerCase().includes(q);
        const garageMatch = (ord.garageName || "").toLowerCase().includes(q);
        const itemMatch =
          Array.isArray(ord.metadata?.items) &&
          ord.metadata.items.some((it: any) =>
            (it.productName || it.name || "").toLowerCase().includes(q)
          );

        if (
          !orderIdMatch &&
          !invoiceMatch &&
          !dealerNameMatch &&
          !storeMatch &&
          !cityMatch &&
          !phoneMatch &&
          !staffMatch &&
          !garageMatch &&
          !itemMatch
        ) {
          return false;
        }
      }

      return true;
    });
  }, [orders, dateFilter, statusFilter, searchQuery, trackingMap]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalVal = 0;
    let todayCount = 0;
    let dueCount = 0;
    orders.forEach((o) => {
      totalVal += Number(o.totalAmount || 0);
      if (o.createdAt && dayjs(o.createdAt).isSame(dayjs(), "day")) {
        todayCount++;
      }
      if (Number(o.outstandingAmount || 0) > 0) {
        dueCount++;
      }
    });
    return {
      totalCount: orders.length,
      totalVal,
      todayCount,
      dueCount
    };
  }, [orders]);

  const openCall = (phone?: string) => {
    if (!phone) return;
    const url = `tel:${phone}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
      else Alert.alert("Error", "Calling is not supported on this device");
    });
  };

  const openUrl = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert("Link Error", "Could not open external URL");
    });
  };

  return (
    <View style={styles.screen}>
      {/* ─── Top Header Bar ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Order & Dispatch History</Text>
          <Text style={styles.headerSubtitle}>
            Live Vaniki Crop Tracking & Goods Photo Proof
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => loadOrderHistory(true)}
          style={styles.refreshButton}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color="#0284C7" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadOrderHistory(true)}
            colors={["#0284C7"]}
          />
        }
      >
        {/* ─── Top KPI Summary Cards ─── */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
            <Ionicons name="receipt-outline" size={18} color="#2563EB" />
            <Text style={[styles.kpiVal, { color: "#1E40AF" }]}>{metrics.totalCount}</Text>
            <Text style={styles.kpiLabel}>Total Orders</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
            <Ionicons name="calendar-outline" size={18} color="#059669" />
            <Text style={[styles.kpiVal, { color: "#065F46" }]}>{metrics.todayCount}</Text>
            <Text style={styles.kpiLabel}>Today's Orders</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
            <Ionicons name="wallet-outline" size={18} color="#16A34A" />
            <Text style={[styles.kpiVal, { color: "#166534", fontSize: 14 }]}>
              ₹{metrics.totalVal > 99999 ? `${(metrics.totalVal / 1000).toFixed(0)}k` : metrics.totalVal.toLocaleString("en-IN")}
            </Text>
            <Text style={styles.kpiLabel}>Order Value</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
            <Text style={[styles.kpiVal, { color: "#991B1B" }]}>{metrics.dueCount}</Text>
            <Text style={styles.kpiLabel}>Due Udhaar</Text>
          </View>
        </View>

        {/* ─── Instant Invoice Direct Tracking Bar ─── */}
        <Card style={styles.directTrackCard}>
          <Card.Content style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Ionicons name="navigate-circle" size={18} color="#0284C7" />
              <Text style={styles.directTrackTitle}>Direct Vaniki Crop Tracking</Text>
              <Badge style={{ backgroundColor: "#0284C7", marginLeft: "auto" }}>Live API</Badge>
            </View>
            <Text style={styles.directTrackSubtitle}>
              Check instant dispatch trace and goods photo by invoice number
            </Text>
            <View style={styles.directTrackInputRow}>
              <TextInput
                style={styles.directTrackInput}
                placeholder="Enter Invoice # (e.g. 273, B2B-356117421)"
                placeholderTextColor="#94A3B8"
                value={directInvoiceQuery}
                onChangeText={setDirectInvoiceQuery}
                autoCapitalize="characters"
              />
              <Button
                mode="contained"
                onPress={handleDirectTrack}
                loading={isDirectSearching}
                disabled={isDirectSearching || !directInvoiceQuery.trim()}
                buttonColor="#0284C7"
                style={styles.directTrackBtn}
                contentStyle={{ paddingHorizontal: 4 }}
              >
                Track
              </Button>
            </View>

            {/* Direct Tracking Result Card */}
            {directTrackingResult && (
              <View style={styles.directResultBox}>
                <View style={styles.directResultHeader}>
                  <Text style={styles.directResultInvoice}>
                    Invoice #{directTrackingResult.invoiceNo || directInvoiceQuery}
                  </Text>
                  <View
                    style={[
                      styles.statusPillBadge,
                      directTrackingResult.isSubmitted ? styles.statusPillGreen : styles.statusPillAmber
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillBadgeText,
                        directTrackingResult.isSubmitted ? { color: "#166534" } : { color: "#B45309" }
                      ]}
                    >
                      {directTrackingResult.isSubmitted ? "✅ SUBMITTED / IN TRANSIT" : "⏳ WAREHOUSE PENDING"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.directResultDestination}>
                  📍 Destination: <Text style={{ fontWeight: "700" }}>{directTrackingResult.destination || directTrackingResult.dealer?.city || "N/A"}</Text>
                </Text>

                {directTrackingResult.transport?.vehicleNumber && (
                  <Text style={styles.directResultTransport}>
                    🚚 Vehicle No: <Text style={{ fontWeight: "700" }}>{directTrackingResult.transport.vehicleNumber}</Text>
                  </Text>
                )}

                {directTrackingResult.transport?.driverName && (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                    <Text style={styles.directResultDriver}>
                      👤 Driver: {directTrackingResult.transport.driverName}
                    </Text>
                    {directTrackingResult.transport.driverMobile && (
                      <TouchableOpacity
                        onPress={() => openCall(directTrackingResult.transport?.driverMobile)}
                        style={styles.callDriverBtn}
                      >
                        <Ionicons name="call" size={12} color="#FFFFFF" />
                        <Text style={styles.callDriverBtnText}>
                          {directTrackingResult.transport.driverMobile}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Uploaded Goods Photo proof */}
                {directTrackingResult.isPhotoUploaded && directTrackingResult.dispatchPhotoUrl ? (
                  <View style={styles.photoProofContainer}>
                    <View style={styles.photoProofHeader}>
                      <Ionicons name="camera" size={14} color="#059669" />
                      <Text style={styles.photoProofTitle}>Dispatched Goods Photo</Text>
                      <Text style={styles.photoProofHint}>Tap to zoom</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedPhotoUrl(directTrackingResult.dispatchPhotoUrl || null);
                        setSelectedPhotoTitle(`Invoice #${directTrackingResult.invoiceNo || directInvoiceQuery} Goods Photo`);
                      }}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={{ uri: directTrackingResult.dispatchPhotoUrl }}
                        style={styles.goodsImagePreview}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                    {directTrackingResult.photoUploadedAt && (
                      <Text style={styles.photoUploadedAtText}>
                        Uploaded: {dayjs(directTrackingResult.photoUploadedAt).format("DD MMM YYYY, hh:mm A")}
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.noPhotoBox}>
                    <Ionicons name="image-outline" size={16} color="#94A3B8" />
                    <Text style={styles.noPhotoText}>
                      Goods dispatch photo will appear here once warehouse dispatches the order.
                    </Text>
                  </View>
                )}

                {/* PDF Link */}
                {directTrackingResult.pdfUrl && (
                  <TouchableOpacity
                    onPress={() => openUrl(directTrackingResult.pdfUrl)}
                    style={styles.pdfStatementBtn}
                  >
                    <Ionicons name="document-text" size={15} color="#0284C7" />
                    <Text style={styles.pdfStatementText}>View Delivery Statement PDF</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* ─── Date Filter Tabs ─── */}
        <View style={styles.dateFilterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateFilterScroll}>
            {[
              { key: "TODAY", label: "📅 Today" },
              { key: "YESTERDAY", label: "Yesterday" },
              { key: "THIS_WEEK", label: "This Week" },
              { key: "THIS_MONTH", label: "This Month" },
              { key: "ALL", label: "All Time" }
            ].map((tab) => {
              const isActive = dateFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setDateFilter(tab.key as any)}
                  style={[styles.dateFilterPill, isActive && styles.dateFilterPillActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateFilterText, isActive && styles.dateFilterTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Search & Status Filters ─── */}
        <View style={styles.searchAndStatusWrapper}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#64748B" />
            <TextInput
              placeholder="Search Invoice #, Dealer, Store, City, Item..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusPillsRow}>
            {[
              { key: "ALL", label: "All Orders" },
              { key: "DISPATCHED", label: "🚚 Dispatched" },
              { key: "PENDING", label: "⏳ Pending" },
              { key: "DUE", label: "⚠️ Due Udhaar" },
              { key: "PAID", label: "✅ Fully Paid" }
            ].map((st) => {
              const isActive = statusFilter === st.key;
              return (
                <TouchableOpacity
                  key={st.key}
                  onPress={() => setStatusFilter(st.key as any)}
                  style={[styles.statusPill, isActive && styles.statusPillActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.statusPillText, isActive && styles.statusPillTextActive]}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Orders List ─── */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>Loading all wholesale orders & dispatches...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={54} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Orders Found</Text>
            <Text style={styles.emptySubtitle}>
              {dateFilter === "TODAY"
                ? "No orders were placed today. Switch to 'All Time' or change filters."
                : "No orders match the selected filters."}
            </Text>
            {dateFilter !== "ALL" && (
              <Button
                mode="contained"
                onPress={() => {
                  setDateFilter("ALL");
                  setStatusFilter("ALL");
                  setSearchQuery("");
                }}
                buttonColor="#0284C7"
                style={{ marginTop: 14, borderRadius: 10 }}
              >
                View All Orders
              </Button>
            )}
          </View>
        ) : (
          filteredOrders.map((ord: any) => {
            const isDue = Number(ord.outstandingAmount || 0) > 0;
            const isExpanded = expandedOrderIds[ord.id || ord.orderId];
            const inv = (ord.invoiceNumber || "").trim();
            const tracking = inv ? trackingMap[inv] : undefined;
            const isTrackingLoading = inv ? loadingTrackingMap[inv] : false;
            const formattedDate = ord.createdAt
              ? dayjs(ord.createdAt).format("DD MMM YYYY, hh:mm A")
              : "";
            const isToday = ord.createdAt && dayjs(ord.createdAt).isSame(dayjs(), "day");
            const items = ord.metadata?.items || [];

            return (
              <Card key={ord.id || ord.orderId} style={styles.orderCard}>
                <Card.Content>
                  {/* Order Top Header */}
                  <View style={styles.orderCardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={styles.orderCardId}>
                          #{ord.orderId ? ord.orderId.slice(-8).toUpperCase() : ord.id.slice(-8).toUpperCase()}
                        </Text>
                        {isToday && (
                          <View style={styles.todayTag}>
                            <Text style={styles.todayTagText}>TODAY</Text>
                          </View>
                        )}
                        {inv ? (
                          <View style={styles.invoiceTag}>
                            <Text style={styles.invoiceTagText}>Inv: #{inv}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.orderDealerName} numberOfLines={1}>
                        🏪 {ord.dealerName || "Vaniki Dealer"}
                      </Text>
                      {ord.storeName ? (
                        <Text style={styles.orderStoreSub} numberOfLines={1}>
                          {ord.storeName} • {ord.dealerCity || "Chhattisgarh"}
                        </Text>
                      ) : null}
                    </View>

                    {/* Amount & Due Status */}
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.orderAmount}>
                        ₹{Number(ord.totalAmount || 0).toLocaleString("en-IN")}
                      </Text>
                      <View
                        style={[
                          styles.paymentStatusBadge,
                          isDue ? styles.paymentStatusDue : styles.paymentStatusPaid
                        ]}
                      >
                        <Text
                          style={[
                            styles.paymentStatusText,
                            isDue ? styles.paymentStatusDueText : styles.paymentStatusPaidText
                          ]}
                        >
                          {isDue ? `Due: ₹${Number(ord.outstandingAmount).toLocaleString("en-IN")}` : "Fully Paid"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Date & Staff */}
                  <View style={styles.orderDateRow}>
                    <Ionicons name="time-outline" size={13} color="#64748B" />
                    <Text style={styles.orderDateText}>
                      {formattedDate} • Placed by <Text style={{ fontWeight: "700" }}>{ord.staffName || "Field Staff"}</Text>
                    </Text>
                  </View>

                  {/* Petis & Garage meta pills */}
                  <View style={styles.orderMetaBar}>
                    <Text style={styles.orderMetaPill}>
                      📦 {ord.petis || 0} Petis ({ord.itemsCount || items.length || 0} items)
                    </Text>
                    <Text style={styles.orderMetaPill}>
                      🏬 {ord.metadata?.garageName || ord.garageName || "Vaniki Warehouse"}
                    </Text>
                    <Text style={styles.orderMetaPill}>
                      💳 {(ord.paymentMode || "Credit").toUpperCase()}
                    </Text>
                  </View>

                  {/* ─── Real-Time Vaniki Crop Live Dispatch Box ─── */}
                  {inv ? (
                    <View style={styles.liveDispatchCard}>
                      <View style={styles.liveDispatchHeaderRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <Ionicons name="flash" size={14} color="#0284C7" />
                          <Text style={styles.liveDispatchHeading}>Live Vaniki Crop Dispatch</Text>
                        </View>
                        {isTrackingLoading ? (
                          <ActivityIndicator size="small" color="#0284C7" />
                        ) : tracking ? (
                          <View
                            style={[
                              styles.dispatchBadge,
                              tracking.isSubmitted ? styles.dispatchBadgeSubmitted : styles.dispatchBadgePending
                            ]}
                          >
                            <Text
                              style={[
                                styles.dispatchBadgeText,
                                tracking.isSubmitted ? { color: "#166534" } : { color: "#B45309" }
                              ]}
                            >
                              {tracking.isSubmitted ? "✅ DISPATCHED / IN TRANSIT" : "⏳ PENDING DISPATCH"}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => fetchTrackingForInvoice(inv)}
                            style={styles.refreshTrackPill}
                          >
                            <Text style={styles.refreshTrackPillText}>Check Live Status</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {tracking ? (
                        <View style={styles.trackingDetailsBody}>
                          {/* Destination & Vehicle */}
                          <View style={styles.trackingDetailRow}>
                            <Text style={styles.trackingDetailLabel}>📍 Destination:</Text>
                            <Text style={styles.trackingDetailVal}>
                              {tracking.destination || ord.dealerCity || "In Transit"}
                            </Text>
                          </View>

                          {tracking.transport?.vehicleNumber ? (
                            <View style={styles.trackingDetailRow}>
                              <Text style={styles.trackingDetailLabel}>🚚 Vehicle No:</Text>
                              <Text style={styles.trackingDetailVal}>
                                {tracking.transport.vehicleNumber}
                              </Text>
                            </View>
                          ) : null}

                          {tracking.transport?.driverName ? (
                            <View style={styles.driverCallRow}>
                              <Text style={styles.driverNameText}>
                                👤 Driver: <Text style={{ fontWeight: "700" }}>{tracking.transport.driverName}</Text>
                              </Text>
                              {tracking.transport.driverMobile ? (
                                <TouchableOpacity
                                  onPress={() => openCall(tracking.transport?.driverMobile)}
                                  style={styles.callIconBtn}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="call" size={13} color="#FFFFFF" />
                                  <Text style={styles.callIconBtnText}>Call Driver</Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          ) : null}

                          {/* Scanned Boxes Count */}
                          {tracking.boxes?.scannedCount ? (
                            <View style={styles.trackingDetailRow}>
                              <Text style={styles.trackingDetailLabel}>📦 Scanned Boxes:</Text>
                              <Text style={styles.trackingDetailVal}>
                                {tracking.boxes.scannedCount} Box(es) Verified
                              </Text>
                            </View>
                          ) : null}

                          {/* ─── Dispatched Goods Photo Proof ─── */}
                          {tracking.isPhotoUploaded && tracking.dispatchPhotoUrl ? (
                            <View style={styles.goodsProofBox}>
                              <View style={styles.goodsProofHeader}>
                                <Ionicons name="camera" size={15} color="#059669" />
                                <Text style={styles.goodsProofTitle}>Dispatched Goods Photo Proof</Text>
                                <Text style={styles.goodsProofTap}>Tap to zoom</Text>
                              </View>
                              <TouchableOpacity
                                onPress={() => {
                                  setSelectedPhotoUrl(tracking.dispatchPhotoUrl || null);
                                  setSelectedPhotoTitle(
                                    `Invoice #${inv} Goods Photo • ${ord.dealerName || ""}`
                                  );
                                }}
                                activeOpacity={0.85}
                              >
                                <Image
                                  source={{ uri: tracking.dispatchPhotoUrl }}
                                  style={styles.goodsImage}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                              {tracking.photoUploadedAt && (
                                <Text style={styles.goodsUploadedAt}>
                                  Uploaded on {dayjs(tracking.photoUploadedAt).format("DD MMM YYYY, hh:mm A")}
                                </Text>
                              )}
                            </View>
                          ) : (
                            <View style={styles.pendingPhotoNotice}>
                              <Ionicons name="image-outline" size={15} color="#64748B" />
                              <Text style={styles.pendingPhotoText}>
                                {tracking.isSubmitted
                                  ? "Photo proof being synchronized from warehouse..."
                                  : "Goods dispatch photo will be attached once warehouse scans and ships this order."}
                              </Text>
                            </View>
                          )}

                          {/* PDF Statement Action */}
                          {tracking.pdfUrl && (
                            <TouchableOpacity
                              onPress={() => openUrl(tracking.pdfUrl)}
                              style={styles.viewPdfBtn}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="document-text" size={15} color="#0284C7" />
                              <Text style={styles.viewPdfBtnText}>
                                View Official Delivery Statement PDF
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.awaitingTrackText}>
                          Tap 'Check Live Status' or expand order to fetch real-time dispatch trace.
                        </Text>
                      )}
                    </View>
                  ) : null}

                  {/* ─── Ordered Items Accordion ─── */}
                  {Array.isArray(items) && items.length > 0 && (
                    <View style={styles.itemsAccordionWrapper}>
                      <TouchableOpacity
                        onPress={() => toggleOrderExpand(ord.id || ord.orderId, inv)}
                        style={styles.itemsAccordionToggle}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.itemsAccordionToggleText}>
                          {isExpanded
                            ? "Hide Ordered Items"
                            : `View Ordered Items (${items.length})`}
                        </Text>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={15}
                          color="#0284C7"
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.itemsListContainer}>
                          {items.map((it: any, idx: number) => (
                            <View key={idx} style={styles.itemRow}>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.itemName} numberOfLines={1}>
                                  {it.productName || it.name || "Product"}
                                </Text>
                                <Text style={styles.itemMeta}>
                                  {it.packSize ? `Pack: ${it.packSize} • ` : ""}
                                  {it.petiQty ? `${it.petiQty} Peti ` : ""}({it.qty || 1} units)
                                </Text>
                              </View>
                              <Text style={styles.itemPrice}>
                                ₹{Number(it.total || (it.price * (it.qty || 1)) || 0).toLocaleString("en-IN")}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* ─── Full-Screen Photo Zoom Modal ─── */}
      <Modal
        visible={Boolean(selectedPhotoUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoUrl(null)}
      >
        <View style={styles.photoModalBackdrop}>
          <View style={styles.photoModalHeader}>
            <Text style={styles.photoModalTitle} numberOfLines={1}>
              {selectedPhotoTitle || "Dispatched Goods Photo"}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedPhotoUrl(null)}
              style={styles.photoModalCloseBtn}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.photoModalBody}>
            {selectedPhotoUrl && (
              <Image
                source={{ uri: selectedPhotoUrl }}
                style={styles.photoModalImage}
                resizeMode="contain"
              />
            )}
          </View>

          <View style={styles.photoModalFooter}>
            <Text style={styles.photoModalFooterText}>
              Proof of Dispatch captured by Vaniki Warehouse Scanner
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    elevation: 2
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9"
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A"
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#E0F2FE"
  },
  container: {
    padding: 14,
    paddingBottom: 40
  },

  /* KPI Summary */
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  kpiCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    alignItems: "center"
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4
  },
  kpiLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2
  },

  /* Direct Track Card */
  directTrackCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  directTrackTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A"
  },
  directTrackSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 10
  },
  directTrackInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  directTrackInput: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0F172A",
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  directTrackBtn: {
    borderRadius: 8
  },
  directResultBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 10
  },
  directResultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  directResultInvoice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0284C7"
  },
  statusPillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusPillGreen: {
    backgroundColor: "#DCFCE7"
  },
  statusPillAmber: {
    backgroundColor: "#FEF3C7"
  },
  statusPillBadgeText: {
    fontSize: 10,
    fontWeight: "800"
  },
  directResultDestination: {
    fontSize: 12,
    color: "#334155",
    marginBottom: 2
  },
  directResultTransport: {
    fontSize: 12,
    color: "#334155",
    marginBottom: 2
  },
  directResultDriver: {
    fontSize: 12,
    color: "#334155"
  },
  callDriverBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#16A34A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  callDriverBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700"
  },

  /* Date Filter Pills */
  dateFilterContainer: {
    marginBottom: 10
  },
  dateFilterScroll: {
    gap: 6
  },
  dateFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  dateFilterPillActive: {
    backgroundColor: "#0284C7",
    borderColor: "#0284C7"
  },
  dateFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  dateFilterTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },

  /* Search & Status */
  searchAndStatusWrapper: {
    marginBottom: 12,
    gap: 8
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: 12,
    color: "#0F172A",
    marginLeft: 6
  },
  statusPillsRow: {
    gap: 6
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  statusPillActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A"
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B"
  },
  statusPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },

  /* Orders List */
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748B"
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 12
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4
  },

  /* Order Card */
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 1
  },
  orderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6
  },
  orderCardId: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A"
  },
  todayTag: {
    backgroundColor: "#059669",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  todayTagText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800"
  },
  invoiceTag: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  invoiceTagText: {
    color: "#1D4ED8",
    fontSize: 10,
    fontWeight: "700"
  },
  orderDealerName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 3
  },
  orderStoreSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A"
  },
  paymentStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3
  },
  paymentStatusDue: {
    backgroundColor: "#FEE2E2"
  },
  paymentStatusPaid: {
    backgroundColor: "#DCFCE7"
  },
  paymentStatusText: {
    fontSize: 10,
    fontWeight: "800"
  },
  paymentStatusDueText: {
    color: "#991B1B"
  },
  paymentStatusPaidText: {
    color: "#166534"
  },

  orderDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4
  },
  orderDateText: {
    fontSize: 11,
    color: "#64748B"
  },

  orderMetaBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8
  },
  orderMetaPill: {
    fontSize: 11,
    color: "#475569",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: "600"
  },

  /* Live Dispatch Card */
  liveDispatchCard: {
    marginTop: 10,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 10,
    padding: 10
  },
  liveDispatchHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  liveDispatchHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0369A1"
  },
  dispatchBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  dispatchBadgeSubmitted: {
    backgroundColor: "#DCFCE7"
  },
  dispatchBadgePending: {
    backgroundColor: "#FEF3C7"
  },
  dispatchBadgeText: {
    fontSize: 9,
    fontWeight: "800"
  },
  refreshTrackPill: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  refreshTrackPillText: {
    fontSize: 10,
    color: "#0369A1",
    fontWeight: "700"
  },
  awaitingTrackText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    fontStyle: "italic"
  },

  trackingDetailsBody: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0F2FE",
    paddingTop: 8,
    gap: 4
  },
  trackingDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  trackingDetailLabel: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600"
  },
  trackingDetailVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A"
  },
  driverCallRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2
  },
  driverNameText: {
    fontSize: 11,
    color: "#334155"
  },
  callIconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#16A34A",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  callIconBtnText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800"
  },

  /* Dispatched Goods Photo Proof */
  goodsProofBox: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  goodsProofHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  goodsProofTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#065F46",
    flex: 1,
    marginLeft: 4
  },
  goodsProofTap: {
    fontSize: 10,
    color: "#0284C7",
    fontWeight: "600"
  },
  goodsImage: {
    width: "100%",
    height: 160,
    borderRadius: 6,
    backgroundColor: "#E2E8F0"
  },
  goodsUploadedAt: {
    fontSize: 9,
    color: "#64748B",
    marginTop: 4,
    textAlign: "right"
  },
  pendingPhotoNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: 8,
    marginTop: 6
  },
  pendingPhotoText: {
    fontSize: 10,
    color: "#64748B",
    flex: 1
  },
  viewPdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0284C7",
    borderRadius: 6,
    paddingVertical: 6,
    marginTop: 6
  },
  viewPdfBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0284C7"
  },

  photoProofContainer: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  photoProofHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  photoProofTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
    flex: 1,
    marginLeft: 4
  },
  photoProofHint: {
    fontSize: 10,
    color: "#0284C7"
  },
  goodsImagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 6,
    backgroundColor: "#E2E8F0"
  },
  photoUploadedAtText: {
    fontSize: 9,
    color: "#64748B",
    marginTop: 4,
    textAlign: "right"
  },
  noPhotoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: 8,
    marginTop: 8
  },
  noPhotoText: {
    fontSize: 11,
    color: "#64748B",
    flex: 1
  },
  pdfStatementBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0284C7",
    borderRadius: 6,
    paddingVertical: 6,
    marginTop: 8
  },
  pdfStatementText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0284C7"
  },

  /* Accordion */
  itemsAccordionWrapper: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 6
  },
  itemsAccordionToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  itemsAccordionToggleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0284C7"
  },
  itemsListContainer: {
    marginTop: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    padding: 8,
    gap: 6
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  itemName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B"
  },
  itemMeta: {
    fontSize: 10,
    color: "#64748B"
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A"
  },

  /* Photo Modal Preview */
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "space-between"
  },
  photoModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 20,
    paddingBottom: 10
  },
  photoModalTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    flex: 1
  },
  photoModalCloseBtn: {
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20
  },
  photoModalBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  photoModalImage: {
    width: SCREEN_WIDTH - 20,
    height: "80%"
  },
  photoModalFooter: {
    padding: 16,
    alignItems: "center"
  },
  photoModalFooterText: {
    color: "#94A3B8",
    fontSize: 11
  }
});
