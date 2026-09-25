import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { MainNavigator } from "./src/navigation/MainNavigator";
import { initGlobalHandler } from "./src/utils/ErrorHandler";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Oswald_500Medium } from "@expo-google-fonts/oswald";
import { Urbanist_400Regular, Urbanist_700Bold } from "@expo-google-fonts/urbanist";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { View, Platform } from "react-native";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { BiometricGate } from "./src/components/BiometricGate";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import * as Notifications from "expo-notifications";
import { initNotifications } from "./src/utils/NotificationService";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Configure foreground notifications safely
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.log("[App] setNotificationHandler error:", e);
}

export default function App() {
  console.log("--- APP STARTING UP ---");
  console.log(`[ENV] __DEV__: ${__DEV__} | Platform: ${Platform.OS} ${Platform.Version || ''}`);

  const [fontsLoaded, fontError] = useFonts({
    Oswald_500Medium,
    Urbanist_400Regular,
    Urbanist_700Bold,
    PlayfairDisplay_700Bold,
  });

  const [fontTimeoutPassed, setFontTimeoutPassed] = useState(false);

  useEffect(() => {
    try {
      initGlobalHandler();
      initNotifications().catch(() => {});
    } catch (e) {
      console.log("[App] Init error:", e);
    }

    // 2.5s fallback so older Android 5.0 devices never stall on splash
    const timer = setTimeout(() => {
      setFontTimeoutPassed(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const readyToRender = fontsLoaded || fontError || fontTimeoutPassed;

  const onLayoutRootView = React.useCallback(async () => {
    if (readyToRender) {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {}
    }
  }, [readyToRender]);

  if (!readyToRender) {
    return <View style={{ flex: 1, backgroundColor: '#003631' }} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <BiometricGate>
              <NavigationContainer theme={{
                ...DefaultTheme,
                colors: {
                  ...DefaultTheme.colors,
                  background: '#003631', // Force Forest Green background globally
                }
              }}>
                <StatusBar style="light" translucent backgroundColor="transparent" />
                <MainNavigator onReady={onLayoutRootView} />
              </NavigationContainer>
            </BiometricGate>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
