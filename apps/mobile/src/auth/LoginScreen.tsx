import { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, View, TouchableOpacity } from "react-native";
import { Button, HelperText, Surface, Text, TextInput } from "react-native-paper";

import { appIconSource } from "../components/AppIcon";
import { useAuth } from "./AuthContext";
import { sendForgotPasswordOtp, resetPassword } from "../api";

export function LoginScreen() {
  const { signIn, companyName } = useAuth();
  
  // Login form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password flow states
  const [view, setView] = useState<"LOGIN" | "FORGOT_SEND" | "FORGOT_RESET">("LOGIN");
  const [identifier, setIdentifier] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [otpSentPhone, setOtpSentPhone] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (loginError: any) {
      const message = loginError.response?.data?.message || loginError.message || "Login failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendOtp() {
    if (!identifier.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await sendForgotPasswordOtp({ identifier: identifier.trim() });
      setVerificationId(res.verificationId);
      setOtpSentPhone(res.mobileNumber);
      setView("FORGOT_RESET");
      setOtpCode("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("OTP Sent", `An OTP has been sent to your registered mobile number: ******${res.mobileNumber.slice(-4)}`);
    } catch (otpError: any) {
      const message = otpError.response?.data?.message || otpError.message || "Failed to send OTP";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!otpCode.trim()) {
      setError("Please enter the verification code");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword({
        identifier: identifier.trim(),
        verificationId,
        code: otpCode.trim(),
        newPassword
      });
      Alert.alert("Success", "Your password has been reset successfully. Please login using your new password.");
      setView("LOGIN");
      setPassword(""); // Clear password field
      setError(null);
    } catch (resetError: any) {
      const message = resetError.response?.data?.message || resetError.message || "Failed to reset password";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleBackToLogin = () => {
    setView("LOGIN");
    setError(null);
  };

  const renderLoginForm = () => {
    const disabled = !email.trim() || !password || isSubmitting;
    return (
      <View style={styles.form}>
        <Text style={styles.inputLabel}>Email Address / Phone</Text>
        <TextInput
          autoCapitalize="none"
          placeholder="e.g. name@company.com or 9876543210"
          mode="outlined"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          activeOutlineColor="#1A202C"
          outlineColor="#E0E0E0"
          theme={{ roundness: 12 }}
          contentStyle={{ paddingHorizontal: 16 }}
        />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.inputLabel}>Password</Text>
          <TouchableOpacity onPress={() => { setView("FORGOT_SEND"); setError(null); setIdentifier(email); }}>
            <Text style={styles.forgotLink}>Forgot?</Text>
          </TouchableOpacity>
        </View>
        
        <TextInput
          autoCapitalize="none"
          placeholder="••••••••"
          mode="outlined"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          activeOutlineColor="#1A202C"
          outlineColor="#E0E0E0"
          theme={{ roundness: 12 }}
          contentStyle={{ paddingHorizontal: 16 }}
          right={
            <TextInput.Icon
              icon={appIconSource(showPassword ? "eye-off" : "eye")}
              onPress={() => setShowPassword(!showPassword)}
              color="#1A202C"
            />
          }
        />
        {error && (
          <HelperText type="error" visible={Boolean(error)} style={{ marginBottom: 8 }}>
            {error}
          </HelperText>
        )}
        <Button
          disabled={disabled}
          icon={appIconSource("login")}
          loading={isSubmitting}
          mode="contained"
          onPress={handleLogin}
          style={styles.button}
          contentStyle={{ height: 48 }}
          labelStyle={{ fontWeight: "700", color: "#FFFFFF" }}
          textColor="#FFFFFF"
        >
          Sign in
        </Button>
      </View>
    );
  };

  const renderForgotSendForm = () => {
    const disabled = !identifier.trim() || isSubmitting;
    return (
      <View style={styles.form}>
        <Text style={styles.formTitle}>Forgot Password</Text>
        <Text style={styles.formSubtitle}>Enter your registered email or phone number. We will send you an OTP code to reset your password.</Text>
        
        <Text style={styles.inputLabel}>Email Address / Phone</Text>
        <TextInput
          autoCapitalize="none"
          placeholder="e.g. name@company.com or 9876543210"
          mode="outlined"
          value={identifier}
          onChangeText={setIdentifier}
          style={styles.input}
          activeOutlineColor="#1A202C"
          outlineColor="#E0E0E0"
          theme={{ roundness: 12 }}
          contentStyle={{ paddingHorizontal: 16 }}
        />

        {error && (
          <HelperText type="error" visible={Boolean(error)} style={{ marginBottom: 8 }}>
            {error}
          </HelperText>
        )}
        
        <Button
          disabled={disabled}
          loading={isSubmitting}
          mode="contained"
          onPress={handleSendOtp}
          style={styles.button}
          contentStyle={{ height: 48 }}
          labelStyle={{ fontWeight: "700", color: "#FFFFFF" }}
          textColor="#FFFFFF"
        >
          Send OTP
        </Button>

        <TouchableOpacity onPress={handleBackToLogin} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderForgotResetForm = () => {
    const disabled = !otpCode.trim() || !newPassword || !confirmPassword || isSubmitting;
    return (
      <View style={styles.form}>
        <Text style={styles.formTitle}>Reset Password</Text>
        <Text style={styles.formSubtitle}>OTP has been sent to ******{otpSentPhone.slice(-4)}. Enter code and your new password below.</Text>
        
        <Text style={styles.inputLabel}>OTP Code (4 digits)</Text>
        <TextInput
          keyboardType="numeric"
          placeholder="e.g. 1234"
          mode="outlined"
          value={otpCode}
          onChangeText={setOtpCode}
          maxLength={6}
          style={styles.input}
          activeOutlineColor="#1A202C"
          outlineColor="#E0E0E0"
          theme={{ roundness: 12 }}
          contentStyle={{ paddingHorizontal: 16 }}
        />

        <Text style={styles.inputLabel}>New Password</Text>
        <TextInput
          autoCapitalize="none"
          placeholder="••••••••"
          mode="outlined"
          secureTextEntry={!showNewPassword}
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.input}
          activeOutlineColor="#1A202C"
          outlineColor="#E0E0E0"
          theme={{ roundness: 12 }}
          contentStyle={{ paddingHorizontal: 16 }}
          right={
            <TextInput.Icon
              icon={appIconSource(showNewPassword ? "eye-off" : "eye")}
              onPress={() => setShowNewPassword(!showNewPassword)}
              color="#1A202C"
            />
          }
        />

        <Text style={styles.inputLabel}>Confirm New Password</Text>
        <TextInput
          autoCapitalize="none"
          placeholder="••••••••"
          mode="outlined"
          secureTextEntry={!showNewPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
          activeOutlineColor="#1A202C"
          outlineColor="#E0E0E0"
          theme={{ roundness: 12 }}
          contentStyle={{ paddingHorizontal: 16 }}
        />

        {error && (
          <HelperText type="error" visible={Boolean(error)} style={{ marginBottom: 8 }}>
            {error}
          </HelperText>
        )}
        
        <Button
          disabled={disabled}
          loading={isSubmitting}
          mode="contained"
          onPress={handleResetPassword}
          style={styles.button}
          contentStyle={{ height: 48 }}
          labelStyle={{ fontWeight: "700", color: "#FFFFFF" }}
          textColor="#FFFFFF"
        >
          Reset Password
        </Button>

        <TouchableOpacity onPress={handleBackToLogin} style={styles.backButton}>
          <Text style={styles.backButtonText}>Cancel & Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <Surface elevation={1} style={styles.panel}>
        <View style={styles.logoContainer}>
          <Image source={require("../../assets/logo.png")} style={styles.logo} />
          <Text variant="headlineMedium" style={styles.title}>
            StaffTrack
          </Text>
        </View>
        {companyName ? <Text style={styles.company}>{companyName}</Text> : null}

        {view === "LOGIN" && renderLoginForm()}
        {view === "FORGOT_SEND" && renderForgotSendForm()}
        {view === "FORGOT_RESET" && renderForgotResetForm()}
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#F7F9F8"
  },
  panel: {
    borderRadius: 16,
    padding: 28,
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      web: {
        boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.05)"
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3
      }
    })
  },

  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10
  },
  title: {
    color: "#1A202C",
    fontWeight: "800",
    fontSize: 28
  },
  company: {
    marginBottom: 20,
    color: "#1A202C",
    fontWeight: "600",
    fontSize: 16,
    opacity: 0.8
  },
  form: {
    marginTop: 0
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4A5552",
    marginBottom: 6,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  input: {
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    height: 52
  },
  button: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#1A202C"
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3B82F6",
    marginBottom: 6,
    marginRight: 4
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A202C",
    marginBottom: 8
  },
  formSubtitle: {
    fontSize: 13,
    color: "#66736F",
    lineHeight: 18,
    marginBottom: 20
  },
  backButton: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3B82F6"
  }
});
