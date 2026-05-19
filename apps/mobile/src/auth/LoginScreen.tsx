import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, HelperText, Surface, Text, TextInput } from "react-native-paper";

import { useAuth } from "./AuthContext";

export function LoginScreen() {
  const { signIn, companyName } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit() {
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

  const disabled = !email.trim() || !password || isSubmitting;

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

        <View style={styles.form}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="e.g. name@company.com"
            mode="outlined"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            activeOutlineColor="#1A202C"
            outlineColor="#E0E0E0"
            theme={{ roundness: 12 }}
            contentStyle={{ paddingHorizontal: 16 }}
          />

          <Text style={styles.inputLabel}>Password</Text>
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
                icon={showPassword ? "eye-off" : "eye"} 
                onPress={() => setShowPassword(!showPassword)}
                color="#1A202C"
              />
            }
          />
          <HelperText type="error" visible={Boolean(error)}>
            {error}
          </HelperText>
          <Button
            disabled={disabled}
            icon="login"
            loading={isSubmitting}
            mode="contained"
            onPress={handleSubmit}
            style={styles.button}
            contentStyle={{ height: 48 }}
            labelStyle={{ fontWeight: "700", color: "#FFFFFF" }}
            textColor="#FFFFFF"
          >
            Sign in
          </Button>
        </View>
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
  }
});
