import React, { useState, useMemo, useRef } from "react";
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
} from "react-native";
import { Text, TextInput, Button, Card, Divider, Badge } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { api } from "../api/client";
import { uploadPhoto, uploadFile } from "../api";
import { AppIcon } from "../components/AppIcon";


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
  variants: Array<{
    id: string;
    label: string;
    dealerPrice: number;
    mrp: number;
    stock: number;
  }>;
}

interface CartItem {
  product: VanikiProduct;
  petiQuantity: number;
}

export function VanikiDealerOrdersScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const catalogLayoutY = useRef<number>(0);

  const [dealerCodeInput, setDealerCodeInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [dealerData, setDealerData] = useState<any | null>(null);

  const [products, setProducts] = useState<VanikiProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [searchProductQuery, setSearchProductQuery] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<"credit" | "cash" | "upi_qr" | "bank_transfer">("credit");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const scrollToCheckout = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const scrollToCatalog = () => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, catalogLayoutY.current - 10),
      animated: true,
    });
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

  // Fetch dynamic bank details on mount
  React.useEffect(() => {
    api
      .get("/vaniki-dealers/bank-details")
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setBankDetails(res.data.data);
        }
      })
      .catch((err) => console.log("Bank details fetch error:", err));
  }, []);

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
        setDealerData(res.data.data);
        if (res.data.data.bankDetails) {
          setBankDetails(res.data.data.bankDetails);
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

  // ─── Cart Operations ───────────────────────────────────────────────────────
  const addToCart = (product: VanikiProduct) => {
    const existingIndex = cart.findIndex((c) => c.product.id === product.id);
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].petiQuantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, petiQuantity: 1 }]);
    }
  };

  const updateCartQty = (productId: string, delta: number) => {
    const updated = [...cart];
    const index = updated.findIndex((c) => c.product.id === productId);
    if (index === -1) return;

    const newQty = updated[index].petiQuantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].petiQuantity = newQty;
    }
    setCart(updated);
  };

  // ─── Calculations ──────────────────────────────────────────────────────────
  const { subtotal, gstAmount, grandTotal, totalPetis } = useMemo(() => {
    let sub = 0;
    let petis = 0;

    cart.forEach((item) => {
      const units = item.petiQuantity * (item.product.petiSize || 10);
      const itemSub = item.product.dealerPrice * units;
      sub += itemSub;
      petis += item.petiQuantity;
    });

    const gst = Math.round(sub * 0.18 * 100) / 100;
    const grand = Math.round((sub + gst) * 100) / 100;

    return {
      subtotal: sub,
      gstAmount: gst,
      grandTotal: grand,
      totalPetis: petis,
    };
  }, [cart]);

  const effectivePaid = paidAmount === "" ? (paymentMode === "credit" ? 0 : grandTotal) : Number(paidAmount);
  const remainingCredit = Math.max(0, grandTotal - effectivePaid);

  // ─── Submit Order ──────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!dealerData?.dealer) {
      Alert.alert("Dealer Required", "Please search and select a dealer first.");
      return;
    }
    if (cart.length === 0) {
      Alert.alert("Cart Empty", "Please add at least 1 product to the order.");
      return;
    }

    const payload = {
      items: cart.map((item) => ({
        productId: item.product.id,
        variantId: item.product.variants?.[0]?.id || item.product.id,
        productName: item.product.name,
        petiQuantity: item.petiQuantity,
        petiSize: item.product.petiSize || 10,
        petiUnit: item.product.petiUnit || "Liter",
        packSize: item.product.packSize,
        dealerPrice: item.product.dealerPrice,
        mrp: item.product.mrp,
        taxRate: 18,
      })),
      paymentMode,
      paidAmount: effectivePaid,
      totalAmount: grandTotal,
      paymentProofUrl: paymentProofUrl || undefined,
      screenshots: paymentProofUrl ? [paymentProofUrl] : undefined,
      utr: utrNumber.trim() || undefined,
      dealDescription: notes.trim() || undefined,
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
          `Order ID: ${res.data.data?.orderId || "Generated"}\nInvoice: ${res.data.data?.invoiceNumber || ""}\nTotal: ₹${grandTotal.toLocaleString("en-IN")}\nRemaining Udhaar: ₹${remainingCredit.toLocaleString("en-IN")}`,
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
              </View>

              <Text style={styles.contactText}>
                📞 {dealerData.dealer.mobile} • 📍 {dealerData.dealer.address?.city || "Chhattisgarh"}
              </Text>

              {/* Financial Metrics */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Credit Limit</Text>
                  <Text style={styles.metricVal}>
                    ₹{(dealerData.credit?.creditLimit || 50000).toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Total Invoiced</Text>
                  <Text style={styles.metricVal}>
                    ₹{(dealerData.ledgerSummary?.totalInvoiced || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Total Paid</Text>
                  <Text style={[styles.metricVal, { color: "#059669" }]}>
                    ₹{(dealerData.ledgerSummary?.totalPaid || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={[styles.metricBox, { backgroundColor: "#FEF2F2" }]}>
                  <Text style={[styles.metricLabel, { color: "#DC2626" }]}>Outstanding Udhaar</Text>
                  <Text style={[styles.metricVal, { color: "#DC2626" }]}>
                    ₹{(dealerData.ledgerSummary?.totalOutstanding || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* ─── Wholesale Product Catalog ─── */}
        {dealerData?.dealer && (
          <View
            style={{ marginTop: 16 }}
            onLayout={(e) => {
              catalogLayoutY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.sectionHeading}>Wholesale Products Catalog</Text>

            <TextInput
              mode="outlined"
              placeholder="Search wholesale products..."
              value={searchProductQuery}
              onChangeText={setSearchProductQuery}
              style={[styles.input, { marginBottom: 12 }]}
              dense
            />

            {isLoadingProducts ? (
              <ActivityIndicator size="small" color="#059669" style={{ marginVertical: 20 }} />
            ) : (
              filteredProducts.map((p) => {
                const inCart = cart.find((c) => c.product.id === p.id);
                const petiSize = p.petiSize || 10;
                const petiPrice = Math.round(p.dealerPrice * petiSize);

                return (
                  <Card key={p.id} style={[styles.productCard, inCart && styles.productCardActive]}>
                    <Card.Content style={styles.productRow}>
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
                          {petiSize} {p.petiUnit}/Box • {p.packSize}
                        </Text>

                        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                          <Text style={styles.dealerPriceText}>₹{p.dealerPrice}/unit</Text>
                          <Text style={styles.mrpText}>MRP ₹{p.mrp}</Text>
                        </View>
                        <Text style={styles.petiPriceText}>Peti Price: ₹{petiPrice}</Text>
                      </View>

                      {/* Stepper / Add */}
                      {inCart ? (
                        <View style={styles.stepperContainer}>
                          <TouchableOpacity
                            onPress={() => updateCartQty(p.id, -1)}
                            style={styles.stepBtn}
                          >
                            <Text style={styles.stepBtnText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.stepVal}>{inCart.petiQuantity} P</Text>
                          <TouchableOpacity
                            onPress={() => updateCartQty(p.id, 1)}
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
                <Text style={styles.cartTitle}>Dealer Order Summary ({totalPetis} Peti)</Text>
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

              {cart.map((item) => (
                <View key={item.product.id} style={styles.cartItemRow}>
                  <Text style={styles.cartItemName} numberOfLines={1}>
                    {item.petiQuantity}x {item.product.name} ({item.product.packSize})
                  </Text>
                  <Text style={styles.cartItemPrice}>
                    ₹{(item.petiQuantity * (item.product.petiSize || 10) * item.product.dealerPrice).toLocaleString("en-IN")}
                  </Text>
                </View>
              ))}

              <Divider style={{ marginVertical: 8 }} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal:</Text>
                <Text style={styles.summaryVal}>₹{subtotal.toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>GST (18%):</Text>
                <Text style={styles.summaryVal}>₹{gstAmount.toLocaleString("en-IN")}</Text>
              </View>
              <View style={[styles.summaryRow, { marginTop: 4 }]}>
                <Text style={[styles.summaryLabel, { fontWeight: "700", color: "#1E293B" }]}>Grand Total:</Text>
                <Text style={[styles.summaryVal, { fontWeight: "800", color: "#059669", fontSize: 16 }]}>
                  ₹{grandTotal.toLocaleString("en-IN")}
                </Text>
              </View>

              {/* Payment Mode Selector */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Payment Mode</Text>
              <View style={styles.paymentModeRow}>
                {(["credit", "cash", "upi_qr", "bank_transfer"] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setPaymentMode(mode)}
                    style={[styles.modeChip, paymentMode === mode && styles.modeChipActive]}
                  >
                    <Text style={[styles.modeChipText, paymentMode === mode && styles.modeChipTextActive]}>
                      {mode === "credit" ? "Credit (Udhaar)" : mode.toUpperCase().replace("_", " ")}
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

              {/* ─── Payment Slip Upload (For UPI / Bank / Cash) ─── */}
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
});

