import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { Component, type ReactNode, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Button, MD3LightTheme, PaperProvider, Text } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "./src/auth/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#1A202C",
    secondary: "#4A5568",
    tertiary: "#718096",
    background: "#F7FAFC",
    surface: "#FFFFFF"
  }
};

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[App] Render error caught", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ marginBottom: 12, textAlign: "center" }} variant="titleMedium">
            StaffTrack could not open this screen.
          </Text>
          <Button mode="contained" onPress={() => this.setState({ hasError: false })}>
            Try again
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) =>
              (error as { response?: { status?: number } })?.response?.status !== 401 &&
              failureCount < 2,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider
          settings={{
            icon: (props) => <MaterialCommunityIcons {...props} />
          }}
          theme={theme}
        >
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppErrorBoundary>
                <AppNavigator />
                <StatusBar style="dark" />
              </AppErrorBoundary>
            </AuthProvider>
          </QueryClientProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
