import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { NoticeProvider } from "./src/context/NoticeContext";
import { MainNavigator } from "./src/navigation/MainNavigator";
import { initGlobalHandler } from "./src/utils/ErrorHandler";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Oswald_500Medium } from "@expo-google-fonts/oswald";
import { Urbanist_400Regular, Urbanist_700Bold } from "@expo-google-fonts/urbanist";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { View, Platform, Text, StyleSheet } from "react-native";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { BiometricGate } from "./src/components/BiometricGate";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import * as Notifications from "expo-notifications";
import { initNotifications } from "./src/utils/NotificationService";
import { runAutoUpdate } from "./src/utils/UpdateService";
import "./src/i18n";
import { initAppLanguage } from "./src/i18n";
import { AppState } from "react-native";
import { Outbox } from "./src/utils/Outbox";
import apiClient from "./src/api/apiClient";
import { scheduleRecurring, foregroundChecks } from "./src/utils/EngagementService";
import { refreshFlags } from "./src/utils/Flags";

const linking = {
  prefixes: ["storynest://", "https://storynest.app"],
  config: {
    screens: {
      Reader: "s/:storyId",
      UserProfile: "user/:userId",
      Clubs: "clubs",
      ClubDetail: "clubs/:clubId",
      Requests: "requests",
      Main: {
        screens: {
          Home: "home",
          Read: "explore",
          Podcasts: "podcasts",
        },
      },
    },
  },
};

const flushOutbox = () =>
  Outbox.flush(async (item) => {
    if (item.kind === "like" || item.kind === "unlike") {
      await apiClient.post(`/stories/${item.storyId}/like`);
    } else if (item.kind === "bookmark" || item.kind === "unbookmark") {
      await apiClient.post(`/stories/${item.storyId}/bookmark`, { progress: item.payload?.progress ?? 0 });
    } else if (item.kind === "comment") {
      await apiClient.post(`/stories/${item.storyId}/comments`, item.payload);
    }
  }).catch(() => 0);

SplashScreen.preventAutoHideAsync().catch(() => {});

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
  console.log("[App] start", Platform.OS, Platform.Version);

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
      initAppLanguage().catch(() => {});
      initNotifications().catch(() => {});
      // Self-update: silently install OTA + APK updates when enabled.
      setTimeout(() => runAutoUpdate(() => {}).catch(() => {}), 3000);
    } catch (e) {
      console.log("[App] Init error:", e);
    }

    const timer = setTimeout(() => setFontTimeoutPassed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    flushOutbox();
    scheduleRecurring().catch(() => {});
    refreshFlags().catch(() => {});
    const t = setTimeout(() => {
      foregroundChecks().catch(() => {});
      flushOutbox();
    }, 8000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        foregroundChecks().catch(() => {});
        flushOutbox();
        refreshFlags().catch(() => {});
      }
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);

  const readyToRender = fontsLoaded || !!fontError || fontTimeoutPassed;

  const onLayoutRootView = React.useCallback(async () => {
    if (readyToRender) {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {}
    }
  }, [readyToRender]);

  if (!readyToRender) {
    return <View style={styles.boot} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <NoticeProvider>
          <AuthProvider>
            <BiometricGate>
              <NavigationContainer linking={linking as any}
                theme={{
                  ...DefaultTheme,
                  colors: {
                    ...DefaultTheme.colors,
                    background: "#003631",
                  },
                }}
                onReady={() => {
                  onLayoutRootView();
                }}
              >
                <StatusBar style="light" translucent backgroundColor="transparent" />
                <MainNavigator onReady={onLayoutRootView} />
              </NavigationContainer>
            </BiometricGate>
          </AuthProvider>
          </NoticeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: "#003631" },
});
