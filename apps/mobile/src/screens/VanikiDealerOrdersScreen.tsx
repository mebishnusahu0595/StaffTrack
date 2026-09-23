import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { Text, TextInput, Button, Card, Divider, Badge } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { api } from "../api/client";
import { uploadPhoto, uploadFile } from "../api";
import { useAuth } from "../auth/AuthContext";
import { AppIcon } from "../components/AppIcon";

interface ProductVariant {
  id: string;
  label?: string;
  name?: string;
  packSize?: string;
  dealerPrice?: number;
  mrp?: number;
  stock?: number;
  petiSize?: number;
  petiUnit?: string;
}

interface VanikiProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  petiSize: number;
  petiUnit: string;
  packSize: string;
  mrp: number;
  dealerPrice: number;
  petiPrice: number;
  stock: number;
  taxRate?: number;
  variants?: ProductVariant[];
}

interface CartItem {
  cartKey: string; // `${productId}_${variantId || 'base'}`
  product: VanikiProduct;
  variantId?: string;
  variantLabel?: string;
  packSize: string;
  petiSize: number;
  petiUnit: string;
  dealerPrice: number; // without GST
  dealerPriceWithGst: number;
  mrp: number;
  petiQuantity: number;
  taxRate: number;
}

export function VanikiDealerOrdersScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const catalogLayoutY = useRef<number>(0);

  const [dealerCodeInput, setDealerCodeInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [dealerData, setDealerData] = useState<any | null>(null);

  // ─── Real-Time Garages State ─────────────────────────────────────────────
  const [garages, setGarages] = useState<string[]>([
    "Vaniki garage",
    "Raipur Central Hub",
    "Bilaspur Depot",
  ]);
  const [selectedGarage, setSelectedGarage] = useState<string>("Vaniki garage");
  const [isLoadingGarages, setIsLoadingGarages] = useState(false);

  const [products, setProducts] = useState<VanikiProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [searchProductQuery, setSearchProductQuery] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  // Removed "cash" strictly: only credit, upi_qr, or bank_transfer
  const [paymentMode, setPaymentMode] = useState<"credit" | "upi_qr" | "bank_transfer">("credit");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // ─── Credit / Udhaar Management Modal State ──────────────────────────────
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [payUdhaarAmount, setPayUdhaarAmount] = useState("");
  const [payUdhaarMode, setPayUdhaarMode] = useState<"UPI" | "NEFT">("UPI");
  const [payUdhaarUtr, setPayUdhaarUtr] = useState("");
  const [payUdhaarSlipUrl, setPayUdhaarSlipUrl] = useState<string | null>(null);
  const [payUdhaarNotes, setPayUdhaarNotes] = useState("");
  const [isUploadingPaySlip, setIsUploadingPaySlip] = useState(false);
  const [isSubmittingCredit, setIsSubmittingCredit] = useState(false);

  // ─── Order History Expanded State ────────────────────────────────────────
  const [isOrderHistoryExpanded, setIsOrderHistoryExpanded] = useState(false);

  const scrollToCheckout = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const scrollToCatalog = () => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, catalogLayoutY.current - 10),
      animated: true,
    });
  };

  // ─── Session Reset & Auto-Reset on Navigation Blur ────────────────────────
  const resetSession = useCallback(() => {
    setDealerData(null);
    setDealerCodeInput("");
    setCart([]);
    setPaidAmount("");
    setNotes("");
    setPaymentProofUrl(null);
    setUtrNumber("");
    setOrderDocumentUrl(null);
    setOrderDocumentName(null);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("blur", () => {
      // Auto-reset dealer session when leaving screen
      resetSession();
    });
    return unsubscribe;
  }, [navigation, resetSession]);

  const handleExitDealer = () => {
    Alert.alert(
      "Exit Dealer Session?",
      "Are you sure you want to exit? Your cart items and current session will be cleared.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Exit", style: "destructive", onPress: resetSession },
      ]
    );
  };

  // ─── Dynamic Bank Details & Payment Proof State ───────────────────────────
  const [bankDetails, setBankDetails] = useState<{
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    branchName?: string;
    upiId: string;
    qrCodeUrl: string;
  } | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [isUploadingSlip, setIsUploadingSlip] = useState(false);

  // ─── Order Document Attachment State ───────────────────────────────────────
  const [orderDocumentUrl, setOrderDocumentUrl] = useState<string | null>(null);
  const [orderDocumentName, setOrderDocumentName] = useState<string | null>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  // Fetch dynamic bank details & real-time garages on mount
  useEffect(() => {
    api
      .get("/vaniki-dealers/bank-details")
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setBankDetails(res.data.data);
        }
      })
      .catch((err) => console.log("Bank details fetch error:", err));

    loadGarages();
  }, []);

  const loadGarages = async () => {
    try {
      setIsLoadingGarages(true);
      const res = await api.get("/vaniki-dealers/garages");
      if (res.data?.success && Array.isArray(res.data?.data) && res.data.data.length > 0) {
        setGarages(res.data.data);
        // 1st garage auto-selected by default!
        setSelectedGarage(res.data.data[0]);
      }
    } catch (err) {
      console.log("Garages fetch error:", err);
    } finally {
      setIsLoadingGarages(false);
    }
  };

  const handlePickPaymentSlip = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow gallery access to select payment slip.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setIsUploadingSlip(true);
        const url = await uploadPhoto(result.assets[0]);
        setPaymentProofUrl(url);
        Alert.alert("Success", "Payment slip uploaded successfully!");
      }
    } catch (err: any) {
      Alert.alert("Upload Error", err.message || "Failed to upload slip");
    } finally {
      setIsUploadingSlip(false);
    }
  };

  const handleCapturePaymentSlip = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow camera access to take slip photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setIsUploadingSlip(true);
        const url = await uploadPhoto(result.assets[0]);
        setPaymentProofUrl(url);
        Alert.alert("Success", "Payment slip captured and uploaded successfully!");
      }
    } catch (err: any) {
      Alert.alert("Camera Error", err.message || "Failed to capture slip");
    } finally {
      setIsUploadingSlip(false);
    }
  };

  // ─── Dealer Lookup ─────────────────────────────────────────────────────────
  const handleSearchDealer = async (codeToSearch?: string) => {
    const code = (codeToSearch || dealerCodeInput).trim();
    if (!code) {
      Alert.alert("Input Required", "Please enter a 4-digit dealer code or mobile number.");
      return;
    }

    try {
      setIsSearching(true);
      const res = await api.get(`/vaniki-dealers/lookup/${encodeURIComponent(code)}`);
      if (res.data?.success && res.data?.data) {
        const dData = res.data.data;
        setDealerData(dData);
        if (dData.bankDetails) {
          setBankDetails(dData.bankDetails);
        }
        // If dealer lookup returned real-time garages list, update and auto-select 1st
        if (Array.isArray(dData.garages) && dData.garages.length > 0) {
          setGarages(dData.garages);
          setSelectedGarage(dData.garages[0]);
        }
        // Also fetch wholesale products if not already loaded
        if (products.length === 0) {
          loadProducts();
        }
      } else {
        Alert.alert("Not Found", "Dealer with code/mobile not found.");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to find dealer";
      Alert.alert("Search Error", msg);
    } finally {
      setIsSearching(false);
    }
  };

  const loadProducts = async () => {
    try {
      setIsLoadingProducts(true);
      const res = await api.get("/vaniki-dealers/products");
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setProducts(res.data.data);
      }
    } catch (err: any) {
      console.error("Products load error:", err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // ─── Cart Operations with Multiple Variant Support ─────────────────────────
  const addToCart = (product: VanikiProduct, variant?: ProductVariant) => {
    const variantId = variant?.id;
    const cartKey = `${product.id}_${variantId || "base"}`;
    const taxRate = product.taxRate || 18;
    const basePrice = Number(variant?.dealerPrice ?? product.dealerPrice ?? 0);
    const priceWithGst = Math.round(basePrice * (1 + taxRate / 100));
    const petiSize = Number(variant?.petiSize ?? product.petiSize ?? 10);
    const petiUnit = variant?.petiUnit ?? product.petiUnit ?? "Liter";
    const packSize = variant?.packSize ?? variant?.label ?? variant?.name ?? product.packSize ?? "Standard";
    const mrp = Number(variant?.mrp ?? product.mrp ?? 0);

    const existingIndex = cart.findIndex((c) => c.cartKey === cartKey);
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].petiQuantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          cartKey,
          product,
          variantId,
          variantLabel: variant?.label || variant?.name || variant?.packSize,
          packSize,
          petiSize,
          petiUnit,
          dealerPrice: basePrice,
          dealerPriceWithGst: priceWithGst,
          mrp,
          petiQuantity: 1,
          taxRate,
        },
      ]);
    }
  };

  const updateCartQtyByKey = (cartKey: string, delta: number) => {
    const updated = [...cart];
    const index = updated.findIndex((c) => c.cartKey === cartKey);
    if (index === -1) return;

    const newQty = updated[index].petiQuantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].petiQuantity = newQty;
    }
    setCart(updated);
  };

  // ─── Price Calculations with Excl. GST and + GST ─────────────────────────
  const { subtotal, gstAmount, grandTotal, totalPetis } = useMemo(() => {
    let sub = 0;
    let grand = 0;
    let petis = 0;

    cart.forEach((item) => {
      const totalUnits = item.petiQuantity * item.petiSize;
      const lineBase = item.dealerPrice * totalUnits;
      const lineWithGst = item.dealerPriceWithGst * totalUnits;
      sub += lineBase;
      grand += lineWithGst;
      petis += item.petiQuantity;
    });

    const gst = Math.max(0, grand - sub);

    return {
      subtotal: sub,
      gstAmount: gst,
      grandTotal: grand,
      totalPetis: petis,
    };
  }, [cart]);

  const effectivePaid = paidAmount === "" ? (paymentMode === "credit" ? 0 : grandTotal) : Number(paidAmount);
  const remainingCredit = Math.max(0, grandTotal - effectivePaid);

  // ─── Credit Modal Handlers ────────────────────────────────────────────────
  // ─── Credit / Udhaar Payment Handlers ─────────────────────────────────────
  const openCreditModal = () => {
    const outstanding = Number(dealerData?.ledgerSummary?.totalOutstanding || 0);
    setPayUdhaarAmount(outstanding > 0 ? String(outstanding) : "");
    setPayUdhaarMode("UPI");
    setPayUdhaarUtr("");
    setPayUdhaarSlipUrl(null);
    setPayUdhaarNotes("");
    setIsCreditModalOpen(true);
  };

  const handlePickCreditSlip = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow gallery access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        setIsUploadingPaySlip(true);
        const url = await uploadPhoto(result.assets[0]);
        setPayUdhaarSlipUrl(url);
        Alert.alert("Success", "Payment slip attached!");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to upload slip");
    } finally {
      setIsUploadingPaySlip(false);
    }
  };

  const handleCaptureCreditSlip = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow camera access.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!result.canceled && result.assets?.[0]) {
        setIsUploadingPaySlip(true);
        const url = await uploadPhoto(result.assets[0]);
        setPayUdhaarSlipUrl(url);
        Alert.alert("Success", "Payment slip captured!");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to capture slip");
    } finally {
      setIsUploadingPaySlip(false);
    }
  };

  const handleSubmitCreditAction = async () => {
    if (!dealerData?.dealer) return;
    const dealerCode = dealerData.dealer.dealerCode || dealerData.dealer.fourDigitId;

    const amountNum = Number(payUdhaarAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid payment amount greater than 0.");
      return;
    }

    const currentDebt = Number(dealerData?.ledgerSummary?.totalOutstanding || 0);
    const debtCleared = Math.min(currentDebt, amountNum);
    const extraCredit = Math.max(0, amountNum - debtCleared);
    const remainingDebt = Math.max(0, currentDebt - debtCleared);

    try {
      setIsSubmittingCredit(true);
      const res = await api.post("/vaniki-dealers/credit-adjustment", {
        dealerCode,
        type: "PAYMENT",
        amount: amountNum,
        paymentMode: payUdhaarMode.toLowerCase(), // "upi" | "neft"
        utr: payUdhaarUtr.trim() || undefined,
        proofUrl: payUdhaarSlipUrl || undefined,
        notes:
          payUdhaarNotes.trim() ||
          `Udhaar payment received via ${payUdhaarMode} (Cleared: ₹${debtCleared}${
            extraCredit > 0 ? `, Advance Added: ₹${extraCredit}` : ""
          })`,
      });
      if (res.data?.success) {
        let msg = `Payment: ₹${amountNum.toLocaleString("en-IN")} via ${payUdhaarMode}\nDebt Cleared: ₹${debtCleared.toLocaleString("en-IN")}\nRemaining Udhaar: ₹${remainingDebt.toLocaleString("en-IN")}`;
        if (extraCredit > 0) {
          msg += `\n⭐ Advance Added to Credit Balance: ₹${extraCredit.toLocaleString("en-IN")}`;
        }
        Alert.alert("Payment Recorded! 🎉", msg);
        setIsCreditModalOpen(false);
        handleSearchDealer(dealerCode);
      }
    } catch (err: any) {
      Alert.alert("Payment Error", err.response?.data?.message || err.message || "Failed to record payment");
    } finally {
      setIsSubmittingCredit(false);
    }
  };

  // ─── Submit Order with Selected Garage ────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!dealerData?.dealer) {
      Alert.alert("Dealer Required", "Please search and select a dealer first.");
      return;
    }
    if (cart.length === 0) {
      Alert.alert("Cart Empty", "Please add at least 1 product to the order.");
      return;
    }
    if (!selectedGarage) {
      Alert.alert("Garage Required", "Please select a warehouse/garage before placing the order.");
      return;
    }

    const payload = {
      garageName: selectedGarage,
      items: cart.map((item) => ({
        productId: item.product.id,
        variantId: item.variantId || item.product.id,
        productName: item.variantLabel
          ? `${item.product.name} (${item.variantLabel})`
          : item.product.name,
        petiQuantity: item.petiQuantity,
        petiSize: item.petiSize,
        petiUnit: item.petiUnit,
        packSize: item.packSize,
        dealerPrice: item.dealerPriceWithGst, // + GST price used for final order & cart
        baseDealerPrice: item.dealerPrice, // without GST price
        mrp: item.mrp,
        taxRate: item.taxRate,
      })),
      paymentMode,
      paidAmount: effectivePaid,
      totalAmount: grandTotal,
      paymentProofUrl: paymentProofUrl || undefined,
      screenshots: paymentProofUrl ? [paymentProofUrl] : undefined,
      utr: utrNumber.trim() || undefined,
      dealDescription: notes.trim()
        ? `${notes.trim()} (Garage: ${selectedGarage})`
        : `Order delivered to ${selectedGarage}`,
      notes: notes.trim() || undefined,
      documentUrl: orderDocumentUrl || undefined,
      documentName: orderDocumentName || undefined,
    };

    try {
      setIsSubmittingOrder(true);
      const res = await api.post(
        `/vaniki-dealers/orders/${encodeURIComponent(dealerData.dealer.dealerCode)}`,
        payload
      );

      if (res.data?.success) {
        Alert.alert(
          "Order Placed Successfully! 🎉",
          `Order ID: ${res.data.data?.orderId || "Generated"}\nGarage: ${selectedGarage}\nInvoice: ${res.data.data?.invoiceNumber || ""}\nTotal: ₹${grandTotal.toLocaleString("en-IN")}\nRemaining Udhaar: ₹${remainingCredit.toLocaleString("en-IN")}`,
          [
            {
              text: "OK",
              onPress: () => {
                setCart([]);
                setPaidAmount("");
                setNotes("");
                setPaymentProofUrl(null);
                setUtrNumber("");
                setOrderDocumentUrl(null);
                setOrderDocumentName(null);
              },
            },
          ]
        );
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to place order";
      Alert.alert("Order Error", msg);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    searchProductQuery
      ? p.name.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchProductQuery.toLowerCase())
      : true
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#F8FAFC" }}
    >
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.container}>
        {/* ─── Header Search Card ─── */}
        <Card style={styles.searchCard}>
          <Card.Content>
            <Text style={styles.cardHeaderTitle}>Search Vaniki Crop Dealer</Text>
            <Text style={styles.cardHeaderSubtitle}>
              Enter 4-digit code (e.g. 1018) or 10-digit mobile number
            </Text>

            <View style={styles.searchRow}>
              <TextInput
                mode="outlined"
                value={dealerCodeInput}
                onChangeText={setDealerCodeInput}
                placeholder="e.g. 1018"
                style={styles.input}
                dense
                keyboardType="numeric"
              />
              <Button
                mode="contained"
                onPress={() => handleSearchDealer()}
                loading={isSearching}
                disabled={isSearching || !dealerCodeInput.trim()}
                style={styles.searchButton}
                buttonColor="#059669"
              >
                Search
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* ─── Dealer Details & Ledger Card ─── */}
        {dealerData?.dealer && (
          <Card style={styles.dealerCard}>
            <Card.Content>
              <View style={styles.dealerTopRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Badge style={styles.dealerBadge}>
                      {`#${dealerData.dealer.fourDigitId || dealerData.dealer.dealerCode}`}
                    </Badge>
                    <Text style={styles.dealerCode}>{dealerData.dealer.dealerCode}</Text>
                  </View>
                  <Text style={styles.dealerName}>
                    {dealerData.dealer.cleanName || dealerData.dealer.name}
                  </Text>
                  <Text style={styles.storeName}>
                    🏪 {dealerData.dealer.storeName || "Vaniki Authorized Store"}
                  </Text>
                </View>

                {/* Exit Dealer Button */}
                <TouchableOpacity
                  onPress={handleExitDealer}
                  style={styles.exitDealerBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="log-out-outline" size={16} color="#DC2626" />
                  <Text style={styles.exitDealerText}>Exit</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.contactText}>
                📞 {dealerData.dealer.mobile} • 📍 {dealerData.dealer.address?.city || "Chhattisgarh"}
              </Text>

              {/* Financial Metrics with Live Ledger */}
              <View style={styles.metricsGrid}>
                {/* Credit Limit - Strictly Managed by Admin */}
                <View style={styles.metricBox}>
                  <View style={styles.metricHeaderRow}>
                    <Text style={styles.metricLabel}>Credit Limit</Text>
                    <Ionicons name="shield-checkmark-outline" size={12} color="#64748B" />
                  </View>
                  <Text style={styles.metricVal}>
                    ₹{(dealerData.credit?.creditLimit ?? 0).toLocaleString("en-IN")}
                  </Text>
                  <Text style={[styles.metricTapHint, { color: "#64748B" }]}>Admin Managed</Text>
                </View>

                {/* Credit Balance (Advance Wallet) */}
                <View style={[styles.metricBox, (dealerData.credit?.creditBalance || 0) > 0 && { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                  <View style={styles.metricHeaderRow}>
                    <Text style={[styles.metricLabel, (dealerData.credit?.creditBalance || 0) > 0 && { color: "#059669" }]}>Credit Balance</Text>
                    <Ionicons name="wallet" size={12} color={(dealerData.credit?.creditBalance || 0) > 0 ? "#059669" : "#64748B"} />
                  </View>
                  <Text style={[styles.metricVal, { color: (dealerData.credit?.creditBalance || 0) > 0 ? "#059669" : "#334155" }]}>
                    ₹{(dealerData.credit?.creditBalance || 0).toLocaleString("en-IN")}
                  </Text>
                  <Text style={[styles.metricTapHint, { color: (dealerData.credit?.creditBalance || 0) > 0 ? "#059669" : "#94A3B8" }]}>
                    {(dealerData.credit?.creditBalance || 0) > 0 ? "Advance Available" : "₹0 Advance"}
                  </Text>
                </View>

                {/* Outstanding Udhaar - Tap to Pay */}
                <TouchableOpacity
                  style={[styles.metricBox, styles.metricBoxClickable, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
                  onPress={openCreditModal}
                  activeOpacity={0.7}
                >
                  <View style={styles.metricHeaderRow}>
                    <Text style={[styles.metricLabel, { color: "#DC2626" }]}>Outstanding Udhaar</Text>
                    <Ionicons name="cash-outline" size={12} color="#DC2626" />
                  </View>
                  <Text style={[styles.metricVal, { color: "#DC2626" }]}>
                    ₹{(dealerData.ledgerSummary?.totalOutstanding || 0).toLocaleString("en-IN")}
                  </Text>
                  <Text style={[styles.metricTapHint, { color: "#DC2626", fontWeight: "700" }]}>Tap to Pay Udhaar</Text>
                </TouchableOpacity>

                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Total Paid</Text>
                  <Text style={[styles.metricVal, { color: "#059669" }]}>
                    ₹{(dealerData.ledgerSummary?.totalPaid || 0).toLocaleString("en-IN")}
                  </Text>
                  <Text style={[styles.metricTapHint, { color: "#64748B" }]}>
                    Invoiced: ₹{(dealerData.ledgerSummary?.totalInvoiced || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* ─── Wholesale Order History Section for Field Staff ─── */}
        {dealerData?.dealer && (
          <Card style={styles.historyCard}>
            <Card.Content>
              <TouchableOpacity
                onPress={() => setIsOrderHistoryExpanded(!isOrderHistoryExpanded)}
                style={styles.historyHeaderRow}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <Ionicons name="receipt-outline" size={18} color="#0284C7" />
                  <Text style={styles.historyTitle}>Wholesale Order History</Text>
                  <Badge style={styles.historyBadge}>
                    {dealerData.orders?.length || 0}
                  </Badge>
                </View>
                <Ionicons
                  name={isOrderHistoryExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>

              {isOrderHistoryExpanded && (
                <View style={{ marginTop: 10 }}>
                  <Divider style={{ marginBottom: 10 }} />
                  {(!dealerData.orders || dealerData.orders.length === 0) ? (
                    <View style={styles.emptyHistoryBox}>
                      <Ionicons name="document-text-outline" size={24} color="#94A3B8" />
                      <Text style={styles.emptyHistoryText}>No past orders recorded yet for this dealer.</Text>
                    </View>
                  ) : (
                    dealerData.orders.map((ord: any) => (
                      <View key={ord.id || ord.orderId} style={styles.orderHistoryCard}>
                        <View style={styles.orderHistoryTopRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.orderHistoryId}>
                              {ord.orderId || ord.id}
                            </Text>
                            {ord.invoiceNumber ? (
                              <Text style={styles.orderHistoryInvoice}>
                                Invoice #{ord.invoiceNumber}
                              </Text>
                            ) : null}
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.orderHistoryAmount}>
                              ₹{Number(ord.totalAmount || 0).toLocaleString("en-IN")}
                            </Text>
                            <Badge
                              style={[
                                styles.orderStatusBadge,
                                Number(ord.outstandingAmount || 0) > 0
                                  ? { backgroundColor: "#FEE2E2", color: "#DC2626" }
                                  : { backgroundColor: "#DCFCE7", color: "#15803D" },
                              ]}
                            >
                              {Number(ord.outstandingAmount || 0) > 0
                                ? `Due: ₹${Number(ord.outstandingAmount).toLocaleString("en-IN")}`
                                : "Fully Paid"}
                            </Badge>
                          </View>
                        </View>

                        <View style={styles.orderHistoryMetaRow}>
                          <Text style={styles.orderHistoryMetaText}>
                            📦 {ord.petis || 0} Petis ({ord.itemsCount || 0} items)
                          </Text>
                          <Text style={styles.orderHistoryMetaText}>
                            🏬 {ord.garageName || "Warehouse"}
                          </Text>
                          <Text style={styles.orderHistoryMetaText}>
                            💳 {(ord.paymentMode || "Credit").toUpperCase()}
                          </Text>
                        </View>

                        <Text style={styles.orderHistoryDate}>
                          🕒 {ord.createdAt ? new Date(ord.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""} • By {ord.staffName || "Staff"}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* ─── Real-Time Warehouse / Garage Selector ─── */}
        {dealerData?.dealer && (
          <Card style={styles.garageCard}>
            <Card.Content>
              <View style={styles.garageHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="business" size={18} color="#059669" />
                  <Text style={styles.garageTitle}>Select Dispatch Garage / Warehouse</Text>
                </View>
                <Badge style={styles.garageBadge}>Real-Time</Badge>
              </View>
              <Text style={styles.garageSubtitle}>
                Orders will be dispatched from this garage. (1st garage is auto-selected)
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.garageChipsContainer}
              >
                {garages.map((g) => {
                  const isSelected = selectedGarage === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setSelectedGarage(g)}
                      style={[styles.garageChip, isSelected && styles.garageChipActive]}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "location-outline"}
                        size={15}
                        color={isSelected ? "#FFFFFF" : "#059669"}
                      />
                      <Text style={[styles.garageChipText, isSelected && styles.garageChipTextActive]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Card.Content>
          </Card>
        )}

        {/* ─── Wholesale Product Catalog (Revealed for Selected Garage) ─── */}
        {dealerData?.dealer && (
          <View
            style={{ marginTop: 16 }}
            onLayout={(e) => {
              catalogLayoutY.current = e.nativeEvent.layout.y;
            }}
          >
            <View style={styles.catalogHeadingRow}>
              <Text style={styles.sectionHeading}>Wholesale Products Catalog</Text>
              <Text style={styles.catalogGarageNotice}>
                Dispatching to: <Text style={{ fontWeight: "700", color: "#059669" }}>{selectedGarage}</Text>
              </Text>
            </View>

            <TextInput
              mode="outlined"
              placeholder="Search wholesale products or variants..."
              value={searchProductQuery}
              onChangeText={setSearchProductQuery}
              style={[styles.input, { marginBottom: 12 }]}
              dense
            />

            {isLoadingProducts ? (
              <ActivityIndicator size="small" color="#059669" style={{ marginVertical: 20 }} />
            ) : (
              filteredProducts.map((p) => {
                const taxRate = p.taxRate || 18;
                const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;

                return (
                  <Card key={p.id} style={styles.productCard}>
                    <Card.Content>
                      <View style={styles.productRow}>
                        {p.image ? (
                          <Image source={{ uri: p.image }} style={styles.productImage} />
                        ) : (
                          <View style={[styles.productImage, styles.placeholderImg]}>
                            <Text style={{ fontSize: 10, color: "#94A3B8" }}>No Img</Text>
                          </View>
                        )}

                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.productCategory}>{p.category}</Text>
                          <Text style={styles.productName}>{p.name}</Text>
                          <Text style={styles.petiDesc}>
                            {p.petiSize || 10} {p.petiUnit || "Units"}/Peti • Pack: {p.packSize || "Standard"}
                          </Text>
                        </View>
                      </View>

                      {/* ─── If Product has multiple variants ─── */}
                      {hasVariants ? (
                        <View style={styles.variantsWrapper}>
                          <Text style={styles.variantsTitle}>Choose Variants / Packs:</Text>
                          {p.variants!.map((v) => {
                            const cartKey = `${p.id}_${v.id}`;
                            const inCart = cart.find((c) => c.cartKey === cartKey);
                            const vBasePrice = Number(v.dealerPrice ?? p.dealerPrice ?? 0);
                            const vPriceWithGst = Math.round(vBasePrice * (1 + taxRate / 100));
                            const vPetiSize = Number(v.petiSize ?? p.petiSize ?? 10);
                            const vPetiWithGst = Math.round(vPriceWithGst * vPetiSize);

                            return (
                              <View key={v.id} style={[styles.variantRowBox, inCart && styles.variantRowBoxActive]}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.variantLabel}>
                                    📦 {v.label || v.name || v.packSize || "Variant"}
                                  </Text>
                                  {/* Without GST vs With GST pricing */}
                                  <View style={styles.priceComparisonRow}>
                                    <Text style={styles.priceExclGst}>
                                      ₹{vBasePrice} <Text style={styles.priceSubText}>(Excl. GST)</Text>
                                    </Text>
                                    <Text style={styles.priceDivider}>•</Text>
                                    <Text style={styles.priceWithGst}>
                                      ₹{vPriceWithGst} <Text style={styles.priceSubText}>(+18% GST)</Text>
                                    </Text>
                                  </View>
                                  <Text style={styles.petiSummaryText}>
                                    Peti ({vPetiSize} units): ₹{vPetiWithGst.toLocaleString("en-IN")}{" "}
                                    <Text style={{ fontSize: 10, color: "#64748B" }}>(incl. GST)</Text>
                                  </Text>
                                </View>

                                {/* Stepper or Add button for this variant */}
                                {inCart ? (
                                  <View style={styles.stepperContainer}>
                                    <TouchableOpacity
                                      onPress={() => updateCartQtyByKey(cartKey, -1)}
                                      style={styles.stepBtn}
                                    >
                                      <Text style={styles.stepBtnText}>-</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.stepVal}>{inCart.petiQuantity} P</Text>
                                    <TouchableOpacity
                                      onPress={() => updateCartQtyByKey(cartKey, 1)}
                                      style={[styles.stepBtn, { backgroundColor: "#059669" }]}
                                    >
                                      <Text style={[styles.stepBtnText, { color: "#FFF" }]}>+</Text>
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <Button
                                    mode="contained"
                                    compact
                                    onPress={() => addToCart(p, v)}
                                    buttonColor="#059669"
                                    style={{ alignSelf: "center" }}
                                    labelStyle={{ fontSize: 11 }}
                                  >
                                    + Peti
                                  </Button>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        /* ─── Standard Single Variant Product ─── */
                        (() => {
                          const cartKey = `${p.id}_base`;
                          const inCart = cart.find((c) => c.cartKey === cartKey);
                          const basePrice = Number(p.dealerPrice || 0);
                          const priceWithGst = Math.round(basePrice * (1 + taxRate / 100));
                          const petiSize = Number(p.petiSize || 10);
                          const petiWithGst = Math.round(priceWithGst * petiSize);

                          return (
                            <View style={styles.singleProductBottomRow}>
                              <View style={{ flex: 1 }}>
                                <View style={styles.priceComparisonRow}>
                                  <Text style={styles.priceExclGst}>
                                    ₹{basePrice} <Text style={styles.priceSubText}>(Excl. GST)</Text>
                                  </Text>
                                  <Text style={styles.priceDivider}>•</Text>
                                  <Text style={styles.priceWithGst}>
                                    ₹{priceWithGst} <Text style={styles.priceSubText}>(+18% GST)</Text>
                                  </Text>
                                </View>
                                <Text style={styles.petiSummaryText}>
                                  Peti ({petiSize} units): ₹{petiWithGst.toLocaleString("en-IN")}{" "}
                                  <Text style={{ fontSize: 10, color: "#64748B" }}>(incl. GST)</Text>
                                </Text>
                              </View>

                              {inCart ? (
                                <View style={styles.stepperContainer}>
                                  <TouchableOpacity
                                    onPress={() => updateCartQtyByKey(cartKey, -1)}
                                    style={styles.stepBtn}
                                  >
                                    <Text style={styles.stepBtnText}>-</Text>
                                  </TouchableOpacity>
                                  <Text style={styles.stepVal}>{inCart.petiQuantity} P</Text>
                                  <TouchableOpacity
                                    onPress={() => updateCartQtyByKey(cartKey, 1)}
                                    style={[styles.stepBtn, { backgroundColor: "#059669" }]}
                                  >
                                    <Text style={[styles.stepBtnText, { color: "#FFF" }]}>+</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <Button
                                  mode="contained"
                                  compact
                                  onPress={() => addToCart(p)}
                                  buttonColor="#059669"
                                  style={{ alignSelf: "center" }}
                                  labelStyle={{ fontSize: 11 }}
                                >
                                  + Peti
                                </Button>
                              )}
                            </View>
                          );
                        })()
                      )}
                    </Card.Content>
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* ─── Cart & Order Placement ─── */}
        {cart.length > 0 && (
          <Card style={styles.cartCard}>
            <Card.Content>
              <View style={styles.cartHeaderRow}>
                <View>
                  <Text style={styles.cartTitle}>Dealer Order Summary ({totalPetis} Peti)</Text>
                  <Text style={styles.cartGarageSubtitle}>
                    Dispatch Warehouse: <Text style={{ fontWeight: "700", color: "#059669" }}>{selectedGarage}</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={scrollToCatalog}
                  style={styles.backToCatalogBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-up" size={13} color="#059669" />
                  <Text style={styles.backToCatalogText}>Add More Items</Text>
                </TouchableOpacity>
              </View>
              <Divider style={{ marginVertical: 8 }} />

              <View style={styles.cartScrollWrapper}>
                <ScrollView
                  style={styles.cartScrollView}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  persistentScrollbar={true}
                >
                  {cart.map((item) => (
                    <View key={item.cartKey} style={styles.cartItemRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.cartItemName} numberOfLines={1}>
                          {item.product.name}
                        </Text>
                        <Text style={styles.cartItemVariant}>
                          {item.variantLabel ? `${item.variantLabel} • ` : ""}
                          {item.packSize} ({item.petiQuantity * item.petiSize} units)
                        </Text>
                        <Text style={styles.cartItemPrice}>
                          ₹{(item.petiQuantity * item.petiSize * item.dealerPriceWithGst).toLocaleString("en-IN")}
                        </Text>
                      </View>

                      {/* + and - stepper in cart summary */}
                      <View style={styles.cartStepperRow}>
                        <TouchableOpacity
                          onPress={() => updateCartQtyByKey(item.cartKey, -1)}
                          style={styles.cartStepperBtnMinus}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="remove" size={14} color="#DC2626" />
                        </TouchableOpacity>

                        <View style={styles.cartQtyBadge}>
                          <Text style={styles.cartQtyText}>{item.petiQuantity}</Text>
                          <Text style={styles.cartQtyUnit}>Peti</Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => updateCartQtyByKey(item.cartKey, 1)}
                          style={styles.cartStepperBtnPlus}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={14} color="#059669" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <Divider style={{ marginVertical: 8 }} />

              {/* Explicit Breakdown: Without GST vs GST vs Grand Total (+GST) */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal (Excl. GST):</Text>
                <Text style={styles.summaryVal}>₹{subtotal.toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>GST (18%):</Text>
                <Text style={styles.summaryVal}>₹{gstAmount.toLocaleString("en-IN")}</Text>
              </View>
              <View style={[styles.summaryRow, { marginTop: 4, paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#E2E8F0" }]}>
                <Text style={[styles.summaryLabel, { fontWeight: "700", color: "#1E293B", fontSize: 13 }]}>
                  Grand Total (+ GST):
                </Text>
                <Text style={[styles.summaryVal, { fontWeight: "800", color: "#059669", fontSize: 17 }]}>
                  ₹{grandTotal.toLocaleString("en-IN")}
                </Text>
              </View>

              {/* Payment Mode Selector (Strictly NO CASH) */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Payment Mode (Cash Removed)</Text>
              <View style={styles.paymentModeRow}>
                {(["credit", "upi_qr", "bank_transfer"] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setPaymentMode(mode)}
                    style={[styles.modeChip, paymentMode === mode && styles.modeChipActive]}
                  >
                    <Text style={[styles.modeChipText, paymentMode === mode && styles.modeChipTextActive]}>
                      {mode === "credit"
                        ? "Credit (Udhaar)"
                        : mode === "upi_qr"
                        ? "UPI QR"
                        : "Bank Transfer (NEFT)"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ─── Dynamic UPI QR Card ─── */}
              {paymentMode === "upi_qr" && (
                <View style={styles.dynamicPaymentCard}>
                  <View style={styles.dynamicHeaderRow}>
                    <Text style={styles.dynamicPaymentTitle}>Company Official UPI QR</Text>
                    <Badge style={styles.verifiedBadge}>SuperAdmin Verified</Badge>
                  </View>
                  <Text style={styles.dynamicPaymentSubtitle}>
                    Dealer se ye QR scan karwake payment karwayein (GPay / PhonePe / Paytm)
                  </Text>

                  {/* QR Image */}
                  <View style={styles.qrImageWrapper}>
                    <Image
                      source={{
                        uri:
                          bankDetails?.qrCodeUrl ||
                          "https://vanikicrop.com/uploads/vaniki/company/qr/1789190489272-57d7fadf-853a-42f5-96bf-af56424c6136.jpg",
                      }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  </View>

                  {/* UPI Details */}
                  <View style={styles.bankDetailItem}>
                    <Text style={styles.bankDetailLabel}>Official UPI ID (Long press to copy):</Text>
                    <Text selectable={true} style={styles.bankDetailValueMono}>
                      {bankDetails?.upiId || "vanikicrop@oksbi"}
                    </Text>
                  </View>

                  <View style={styles.bankDetailItem}>
                    <Text style={styles.bankDetailLabel}>Beneficiary Name:</Text>
                    <Text style={styles.bankDetailValue}>
                      {bankDetails?.accountName || "Vaniki Crop Science Pvt Ltd"}
                    </Text>
                  </View>
                </View>
              )}

              {/* ─── Dynamic Bank Details Card ─── */}
              {paymentMode === "bank_transfer" && (
                <View style={styles.dynamicPaymentCard}>
                  <View style={styles.dynamicHeaderRow}>
                    <Text style={styles.dynamicPaymentTitle}>Official Company Bank Details</Text>
                    <Badge style={styles.verifiedBadge}>SuperAdmin Verified</Badge>
                  </View>
                  <Text style={styles.dynamicPaymentSubtitle}>
                    NEFT / RTGS / IMPS transfer ke liye ye details dealer ko dein:
                  </Text>

                  <View style={styles.bankDetailGrid}>
                    <View style={styles.bankDetailItem}>
                      <Text style={styles.bankDetailLabel}>Bank Name:</Text>
                      <Text style={styles.bankDetailValue}>
                        {bankDetails?.bankName || "HDFC Bank"}
                      </Text>
                    </View>

                    <View style={styles.bankDetailItem}>
                      <Text style={styles.bankDetailLabel}>Account Holder:</Text>
                      <Text style={styles.bankDetailValue}>
                        {bankDetails?.accountName || "Vaniki Crop Science Pvt Ltd"}
                      </Text>
                    </View>

                    <View style={styles.bankDetailItem}>
                      <Text style={styles.bankDetailLabel}>Account Number (Selectable):</Text>
                      <Text selectable={true} style={styles.bankDetailValueMonoBold}>
                        {bankDetails?.accountNumber || "50200088991123"}
                      </Text>
                    </View>

                    <View style={styles.bankDetailItem}>
                      <Text style={styles.bankDetailLabel}>IFSC Code (Selectable):</Text>
                      <Text selectable={true} style={styles.bankDetailValueMonoBold}>
                        {bankDetails?.ifscCode || "HDFC0001235"}
                      </Text>
                    </View>

                    {bankDetails?.branchName && (
                      <View style={styles.bankDetailItem}>
                        <Text style={styles.bankDetailLabel}>Branch:</Text>
                        <Text style={styles.bankDetailValue}>{bankDetails.branchName}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* ─── Payment Slip Upload (For UPI / Bank) ─── */}
              {paymentMode !== "credit" && (
                <View style={styles.slipUploadContainer}>
                  <Text style={styles.inputLabel}>Payment Proof Slip / Screenshot</Text>

                  {isUploadingSlip ? (
                    <View style={styles.uploadingBox}>
                      <ActivityIndicator size="small" color="#059669" />
                      <Text style={styles.uploadingText}>Uploading payment proof slip...</Text>
                    </View>
                  ) : paymentProofUrl ? (
                    <View style={styles.slipPreviewRow}>
                      <Image source={{ uri: paymentProofUrl }} style={styles.slipThumb} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.slipAttachedText}>✓ Payment Slip Attached</Text>
                        <TouchableOpacity onPress={() => setPaymentProofUrl(null)}>
                          <Text style={styles.slipRemoveText}>Remove / Change</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.slipBtnRow}>
                      <Button
                        mode="outlined"
                        onPress={handleCapturePaymentSlip}
                        icon="camera"
                        style={styles.slipActionBtn}
                        labelStyle={{ fontSize: 11 }}
                      >
                        Take Photo
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={handlePickPaymentSlip}
                        icon="image"
                        style={styles.slipActionBtn}
                        labelStyle={{ fontSize: 11 }}
                      >
                        From Gallery
                      </Button>
                    </View>
                  )}

                  {/* UTR / Ref Number input */}
                  <TextInput
                    mode="outlined"
                    placeholder="UTR / Transaction Ref No. (Optional)"
                    value={utrNumber}
                    onChangeText={setUtrNumber}
                    style={[styles.input, { marginTop: 8 }]}
                    dense
                  />
                </View>
              )}

              {/* Partial Payment */}
              <Text style={styles.inputLabel}>Amount Paid Now (₹)</Text>
              <TextInput
                mode="outlined"
                placeholder={paymentMode === "credit" ? "0 (Full Credit)" : `${grandTotal}`}
                value={paidAmount}
                onChangeText={setPaidAmount}
                keyboardType="numeric"
                style={styles.input}
                dense
              />

              <View style={styles.creditNotice}>
                <Text style={{ fontSize: 12, color: "#64748B" }}>Remaining Udhaar / Credit:</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: remainingCredit > 0 ? "#D97706" : "#059669" }}>
                  ₹{remainingCredit.toLocaleString("en-IN")}
                </Text>
              </View>

              {/* Deal Notes */}
              <Text style={styles.inputLabel}>Meeting Notes / Terms</Text>
              <TextInput
                mode="outlined"
                placeholder="e.g. 15 days credit agreed..."
                value={notes}
                onChangeText={setNotes}
                style={[styles.input, { minHeight: 60 }]}
                multiline
                dense
              />

              {/* ─── Order Document Upload ─── */}
              <Text style={styles.inputLabel}>Attach Document / Bill / PO</Text>
              <View style={styles.docUploadContainer}>
                {isUploadingDocument ? (
                  <View style={styles.uploadingBox}>
                    <ActivityIndicator size="small" color="#059669" />
                    <Text style={styles.uploadingText}>Uploading document...</Text>
                  </View>
                ) : orderDocumentUrl ? (
                  <View style={styles.docPreviewRow}>
                    <View style={styles.docIconBox}>
                      {orderDocumentName?.toLowerCase().endsWith(".pdf") ? (
                        <Ionicons name="document-text" size={28} color="#DC2626" />
                      ) : (
                        <Image source={{ uri: orderDocumentUrl }} style={styles.docThumb} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docAttachedText} numberOfLines={1}>
                        ✅ {orderDocumentName || "Document attached"}
                      </Text>
                      <TouchableOpacity onPress={() => { setOrderDocumentUrl(null); setOrderDocumentName(null); }}>
                        <Text style={styles.docRemoveText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.docBtnRow}>
                    <TouchableOpacity
                      style={styles.docSourceBtn}
                      onPress={async () => {
                        try {
                          const { status } = await ImagePicker.requestCameraPermissionsAsync();
                          if (status !== "granted") { Alert.alert("Permission", "Camera access required."); return; }
                          const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
                          if (!result.canceled && result.assets?.[0]) {
                            setIsUploadingDocument(true);
                            const url = await uploadPhoto(result.assets[0]);
                            setOrderDocumentUrl(url);
                            setOrderDocumentName(`photo-${Date.now()}.jpg`);
                            setIsUploadingDocument(false);
                          }
                        } catch (err) {
                          setIsUploadingDocument(false);
                          Alert.alert("Error", "Failed to capture photo.");
                        }
                      }}
                    >
                      <Ionicons name="camera" size={20} color="#059669" />
                      <Text style={styles.docSourceBtnText}>Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.docSourceBtn}
                      onPress={async () => {
                        try {
                          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (status !== "granted") { Alert.alert("Permission", "Gallery access required."); return; }
                          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
                          if (!result.canceled && result.assets?.[0]) {
                            setIsUploadingDocument(true);
                            const url = await uploadPhoto(result.assets[0]);
                            setOrderDocumentUrl(url);
                            setOrderDocumentName(`gallery-${Date.now()}.jpg`);
                            setIsUploadingDocument(false);
                          }
                        } catch (err) {
                          setIsUploadingDocument(false);
                          Alert.alert("Error", "Failed to select photo.");
                        }
                      }}
                    >
                      <Ionicons name="images" size={20} color="#059669" />
                      <Text style={styles.docSourceBtnText}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.docSourceBtn}
                      onPress={async () => {
                        try {
                          const result = await DocumentPicker.getDocumentAsync({
                            type: ["application/pdf", "image/*"],
                            copyToCacheDirectory: true,
                          });
                          if (!result.canceled && result.assets?.[0]) {
                            const asset = result.assets[0];
                            setIsUploadingDocument(true);
                            const url = await uploadFile(asset.uri, asset.name, asset.mimeType || "application/octet-stream");
                            setOrderDocumentUrl(url);
                            setOrderDocumentName(asset.name);
                            setIsUploadingDocument(false);
                          }
                        } catch (err) {
                          setIsUploadingDocument(false);
                          Alert.alert("Error", "Failed to select file.");
                        }
                      }}
                    >
                      <Ionicons name="document-attach" size={20} color="#059669" />
                      <Text style={styles.docSourceBtnText}>PDF / File</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Button
                mode="contained"
                onPress={handlePlaceOrder}
                loading={isSubmittingOrder}
                disabled={isSubmittingOrder}
                style={styles.placeOrderBtn}
                buttonColor="#059669"
              >
                Place Dealer Order (₹{grandTotal.toLocaleString("en-IN")})
              </Button>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* ─── Floating Sticky Cart Bar ─── */}
      {cart.length > 0 && (
        <View style={styles.floatingCartBar}>
          <TouchableOpacity
            style={styles.floatingCartContent}
            onPress={scrollToCheckout}
            activeOpacity={0.9}
          >
            <View style={styles.cartBarLeft}>
              <View style={styles.cartIconWrapper}>
                <Ionicons name="cart" size={20} color="#FFFFFF" />
                <Badge style={styles.cartBadge}>{totalPetis}</Badge>
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.cartBarTitle}>
                  {totalPetis} {totalPetis === 1 ? "Peti" : "Petis"} • {cart.length} {cart.length === 1 ? "item" : "items"}
                </Text>
                <Text style={styles.cartBarPrice}>
                  ₹{grandTotal.toLocaleString("en-IN")}{" "}
                  <Text style={styles.cartBarGst}>(incl. 18% GST)</Text>
                </Text>
              </View>
            </View>

            <View style={styles.checkoutBtnContainer}>
              <Text style={styles.checkoutBtnText}>Checkout</Text>
              <Ionicons name="arrow-forward" size={15} color="#064E3B" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Credit & Udhaar Management Action Modal ─── */}
      <Modal
        visible={isCreditModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Pay Dealer Udhaar (Jama)</Text>
                <Text style={styles.modalSubtitle}>
                  {dealerData?.dealer?.cleanName || dealerData?.dealer?.name} (
                  #{dealerData?.dealer?.fourDigitId || dealerData?.dealer?.dealerCode})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsCreditModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Current Financial Status Banner */}
            <View style={styles.modalMetricsBanner}>
              <View style={styles.modalMetricItem}>
                <Text style={[styles.modalMetricLabel, { color: "#DC2626" }]}>Outstanding Udhaar</Text>
                <Text style={[styles.modalMetricValue, { color: "#DC2626" }]}>
                  ₹{(dealerData?.ledgerSummary?.totalOutstanding || 0).toLocaleString("en-IN")}
                </Text>
              </View>
              <View style={styles.modalMetricDivider} />
              <View style={styles.modalMetricItem}>
                <Text style={[styles.modalMetricLabel, { color: "#059669" }]}>Credit Balance</Text>
                <Text style={[styles.modalMetricValue, { color: "#059669" }]}>
                  ₹{(dealerData?.credit?.creditBalance ?? 0).toLocaleString("en-IN")}
                </Text>
              </View>
              <View style={styles.modalMetricDivider} />
              <View style={styles.modalMetricItem}>
                <Text style={styles.modalMetricLabel}>Credit Limit</Text>
                <Text style={styles.modalMetricValue}>
                  ₹{(dealerData?.credit?.creditLimit ?? 0).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={{ paddingTop: 8 }}>
                <Text style={styles.inputLabel}>Payment Amount (₹) *</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Enter amount to pay"
                  value={payUdhaarAmount}
                  onChangeText={setPayUdhaarAmount}
                  keyboardType="numeric"
                  style={styles.input}
                  dense
                />

                {/* Real-time Allocation Preview */}
                {(() => {
                  const entered = Number(payUdhaarAmount) || 0;
                  const outstanding = Number(dealerData?.ledgerSummary?.totalOutstanding || 0);
                  const currCredit = Number(dealerData?.credit?.creditBalance || 0);
                  const debtCleared = Math.min(outstanding, entered);
                  const remainingDebt = Math.max(0, outstanding - debtCleared);
                  const extraCredit = Math.max(0, entered - debtCleared);
                  const newCreditBal = currCredit + extraCredit;

                  if (entered <= 0) return null;

                  return (
                    <View style={styles.calculationPreviewBox}>
                      <Text style={styles.calcPreviewTitle}>Payment Allocation Summary:</Text>
                      <View style={styles.calcPreviewRow}>
                        <Text style={styles.calcPreviewLabel}>Debt to be Cleared:</Text>
                        <Text style={[styles.calcPreviewVal, { color: "#059669" }]}>
                          ₹{debtCleared.toLocaleString("en-IN")}
                        </Text>
                      </View>
                      <View style={styles.calcPreviewRow}>
                        <Text style={styles.calcPreviewLabel}>Remaining Outstanding:</Text>
                        <Text style={[styles.calcPreviewVal, { color: remainingDebt > 0 ? "#DC2626" : "#059669" }]}>
                          ₹{remainingDebt.toLocaleString("en-IN")}
                        </Text>
                      </View>
                      {extraCredit > 0 && (
                        <View style={[styles.calcPreviewRow, { borderTopWidth: 1, borderTopColor: "#A7F3D0", paddingTop: 4, marginTop: 4 }]}>
                          <Text style={[styles.calcPreviewLabel, { color: "#047857", fontWeight: "700" }]}>
                            ⭐ Extra Added to Credit Balance:
                          </Text>
                          <Text style={[styles.calcPreviewVal, { color: "#047857", fontWeight: "800" }]}>
                            +₹{extraCredit.toLocaleString("en-IN")}
                          </Text>
                        </View>
                      )}
                      {extraCredit > 0 && (
                        <View style={styles.calcPreviewRow}>
                          <Text style={styles.calcPreviewLabel}>New Credit Balance:</Text>
                          <Text style={[styles.calcPreviewVal, { color: "#047857", fontWeight: "800" }]}>
                            ₹{newCreditBal.toLocaleString("en-IN")}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })()}

                {/* Payment Mode: Strictly UPI or NEFT */}
                <Text style={[styles.inputLabel, { marginTop: 10 }]}>Payment Method *</Text>
                <View style={styles.creditPaymentModesRow}>
                  {(["UPI", "NEFT"] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setPayUdhaarMode(m)}
                      style={[
                        styles.creditPaymentModeChip,
                        payUdhaarMode === m && styles.creditPaymentModeChipActive,
                      ]}
                    >
                      <Ionicons
                        name={m === "UPI" ? "phone-portrait-outline" : "card-outline"}
                        size={16}
                        color={payUdhaarMode === m ? "#FFFFFF" : "#334155"}
                      />
                      <Text
                        style={[
                          styles.creditPaymentModeText,
                          payUdhaarMode === m && styles.creditPaymentModeTextActive,
                        ]}
                      >
                        {m === "UPI" ? "UPI Payment" : "NEFT / Bank Transfer"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { marginTop: 10 }]}>UTR / Transaction Ref No.</Text>
                <TextInput
                  mode="outlined"
                  placeholder="e.g. 423984729182"
                  value={payUdhaarUtr}
                  onChangeText={setPayUdhaarUtr}
                  style={styles.input}
                  dense
                />

                {/* Payment Slip Upload */}
                <Text style={[styles.inputLabel, { marginTop: 10 }]}>Payment Slip / Screenshot</Text>
                {isUploadingPaySlip ? (
                  <View style={styles.uploadingBox}>
                    <ActivityIndicator size="small" color="#059669" />
                    <Text style={styles.uploadingText}>Uploading slip...</Text>
                  </View>
                ) : payUdhaarSlipUrl ? (
                  <View style={styles.slipPreviewRow}>
                    <Image source={{ uri: payUdhaarSlipUrl }} style={styles.slipThumb} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slipAttachedText}>✓ Slip Attached</Text>
                      <TouchableOpacity onPress={() => setPayUdhaarSlipUrl(null)}>
                        <Text style={styles.slipRemoveText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.slipBtnRow}>
                    <Button
                      mode="outlined"
                      onPress={handleCaptureCreditSlip}
                      icon="camera"
                      style={styles.slipActionBtn}
                      labelStyle={{ fontSize: 11 }}
                    >
                      Camera
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={handlePickCreditSlip}
                      icon="image"
                      style={styles.slipActionBtn}
                      labelStyle={{ fontSize: 11 }}
                    >
                      Gallery
                    </Button>
                  </View>
                )}

                <Text style={[styles.inputLabel, { marginTop: 10 }]}>Notes / Remarks</Text>
                <TextInput
                  mode="outlined"
                  placeholder="e.g. Cheque clearance / online transfer..."
                  value={payUdhaarNotes}
                  onChangeText={setPayUdhaarNotes}
                  style={styles.input}
                  dense
                />

                <Button
                  mode="contained"
                  onPress={handleSubmitCreditAction}
                  loading={isSubmittingCredit}
                  disabled={isSubmittingCredit}
                  buttonColor="#059669"
                  style={{ marginTop: 16 }}
                >
                  Submit Udhaar Payment
                </Button>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 110,
  },
  searchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    elevation: 2,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  searchButton: {
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
  },
  dealerCard: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#059669",
    elevation: 2,
  },
  dealerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dealerBadge: {
    backgroundColor: "#059669",
    fontSize: 11,
    fontWeight: "700",
  },
  dealerCode: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  dealerName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 4,
  },
  storeName: {
    fontSize: 13,
    color: "#059669",
    fontWeight: "600",
    marginTop: 2,
  },
  contactText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 6,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  metricBox: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metricLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  metricVal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  productCard: {
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    elevation: 1,
  },
  productCardActive: {
    borderWidth: 1.5,
    borderColor: "#059669",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    resizeMode: "contain",
  },
  placeholderImg: {
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  productCategory: {
    fontSize: 10,
    color: "#059669",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  productName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  petiDesc: {
    fontSize: 11,
    color: "#64748B",
  },
  dealerPriceText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  mrpText: {
    fontSize: 11,
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  petiPriceText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "700",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    padding: 2,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  stepVal: {
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  cartCard: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderTopWidth: 3,
    borderTopColor: "#059669",
    elevation: 3,
  },
  cartTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  cartItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 3,
  },
  cartItemName: {
    fontSize: 12,
    color: "#334155",
    flex: 1,
  },
  cartItemPrice: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginTop: 8,
    marginBottom: 4,
  },
  paymentModeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
  },
  modeChipActive: {
    backgroundColor: "#059669",
  },
  modeChipText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  modeChipTextActive: {
    color: "#FFFFFF",
  },
  creditNotice: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  placeOrderBtn: {
    marginTop: 16,
    borderRadius: 8,
    paddingVertical: 4,
  },
  dynamicPaymentCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  dynamicHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dynamicPaymentTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#166534",
  },
  verifiedBadge: {
    backgroundColor: "#16A34A",
    fontSize: 9,
    fontWeight: "700",
  },
  dynamicPaymentSubtitle: {
    fontSize: 11,
    color: "#15803D",
    marginTop: 2,
    marginBottom: 8,
  },
  qrImageWrapper: {
    alignItems: "center",
    marginVertical: 8,
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  qrImage: {
    width: 180,
    height: 180,
  },
  bankDetailGrid: {
    marginTop: 4,
    gap: 6,
  },
  bankDetailItem: {
    marginTop: 4,
  },
  bankDetailLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
  },
  bankDetailValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 1,
  },
  bankDetailValueMono: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 1,
  },
  bankDetailValueMonoBold: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 1,
  },
  slipUploadContainer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  uploadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  uploadingText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
  },
  slipPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  slipThumb: {
    width: 50,
    height: 50,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  slipAttachedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16A34A",
  },
  slipRemoveText: {
    fontSize: 11,
    color: "#DC2626",
    marginTop: 2,
  },
  slipBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  slipActionBtn: {
    flex: 1,
    borderRadius: 6,
  },
  cartHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backToCatalogBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 4,
  },
  backToCatalogText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  floatingCartBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 24 : 14,
    left: 14,
    right: 14,
    borderRadius: 16,
    backgroundColor: "#064E3B",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    borderWidth: 1.5,
    borderColor: "#059669",
    overflow: "hidden",
  },
  floatingCartContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cartBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cartIconWrapper: {
    position: "relative",
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#10B981",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  cartBarTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#A7F3D0",
  },
  cartBarPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cartBarGst: {
    fontSize: 10,
    fontWeight: "400",
    color: "#D1FAE5",
  },
  checkoutBtnContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  checkoutBtnText: {
    color: "#064E3B",
    fontSize: 13,
    fontWeight: "700",
  },
  docUploadContainer: {
    marginTop: 4,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  docBtnRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  docSourceBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 4,
  },
  docSourceBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  docPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  docIconBox: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  docThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  docAttachedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16A34A",
  },
  docRemoveText: {
    fontSize: 11,
    color: "#DC2626",
    fontWeight: "600",
    marginTop: 2,
  },
  // ─── Exit Dealer Button ───
  exitDealerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    alignSelf: "flex-start",
  },
  exitDealerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  // ─── Clickable Metric Styles ───
  metricBoxClickable: {
    borderStyle: "dashed",
    borderColor: "#A7F3D0",
  },
  metricHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricTapHint: {
    fontSize: 9,
    color: "#059669",
    fontWeight: "600",
    marginTop: 2,
  },
  // ─── Garage Selection Styles ───
  garageCard: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#059669",
  },
  garageHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  garageTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  garageBadge: {
    backgroundColor: "#059669",
    fontSize: 10,
    fontWeight: "700",
  },
  garageSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 8,
  },
  garageChipsContainer: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  garageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  garageChipActive: {
    backgroundColor: "#059669",
    borderColor: "#047857",
  },
  garageChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  garageChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  // ─── Catalog & Variants ───
  catalogHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  catalogGarageNotice: {
    fontSize: 11,
    color: "#64748B",
  },
  variantsWrapper: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
    gap: 8,
  },
  variantsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
  },
  variantRowBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  variantRowBoxActive: {
    borderColor: "#059669",
    backgroundColor: "#F0FDF4",
  },
  variantLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  priceComparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  priceExclGst: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  priceWithGst: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
  },
  priceSubText: {
    fontSize: 9,
    fontWeight: "500",
    color: "#64748B",
  },
  priceDivider: {
    fontSize: 10,
    color: "#94A3B8",
  },
  petiSummaryText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 2,
  },
  singleProductBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  cartGarageSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  cartItemVariant: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  // ─── Modal Styles ───
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalContentCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  modalMetricsBanner: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalMetricItem: {
    flex: 1,
    alignItems: "center",
  },
  modalMetricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
  },
  modalMetricValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  modalMetricDivider: {
    width: 1,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 8,
  },
  modalTabRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
    marginBottom: 6,
  },
  modalTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  modalTabBtnActive: {
    backgroundColor: "#059669",
    elevation: 1,
  },
  modalTabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  modalTabBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  creditPaymentModesRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  creditPaymentModeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  creditPaymentModeChipActive: {
    backgroundColor: "#059669",
    borderColor: "#047857",
  },
  creditPaymentModeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  creditPaymentModeTextActive: {
    color: "#FFFFFF",
  },
  // ─── Cart Scroll & Stepper Styles ───
  cartScrollWrapper: {
    maxHeight: 280,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  cartScrollView: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cartStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 4,
    marginRight: 6,
  },
  cartStepperBtnMinus: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  cartStepperBtnPlus: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  cartQtyBadge: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 32,
  },
  cartQtyText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  cartQtyUnit: {
    fontSize: 9,
    color: "#64748B",
    marginTop: -2,
  },
  // ─── Order History Section Styles ───
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  historyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  historyBadge: {
    backgroundColor: "#E0F2FE",
    color: "#0369A1",
    fontWeight: "800",
    fontSize: 11,
  },
  emptyHistoryBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 6,
  },
  emptyHistoryText: {
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  orderHistoryCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  orderHistoryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderHistoryId: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  orderHistoryInvoice: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#475569",
    marginTop: 1,
  },
  orderHistoryAmount: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  orderStatusBadge: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  orderHistoryMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  orderHistoryMetaText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  orderHistoryDate: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 4,
  },
  // ─── Payment Allocation Preview Styles ───
  calculationPreviewBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#86EFAC",
    padding: 10,
    marginTop: 8,
  },
  calcPreviewTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#166534",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  calcPreviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  calcPreviewLabel: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
  },
  calcPreviewVal: {
    fontSize: 12,
    fontWeight: "800",
  },
});

