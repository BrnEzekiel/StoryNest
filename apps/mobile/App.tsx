import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { MainNavigator } from "./src/navigation/MainNavigator";
import { initGlobalHandler } from "./src/utils/ErrorHandler";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Oswald_500Medium } from "@expo-google-fonts/oswald";
import { Urbanist_400Regular, Urbanist_700Bold } from "@expo-google-fonts/urbanist";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { Inter_400Regular, Inter_700Bold } from "@expo-google-fonts/inter";
import { Lora_400Regular, Lora_700Bold } from "@expo-google-fonts/lora";
import { Montserrat_700Bold } from "@expo-google-fonts/montserrat";
import { OpenSans_400Regular, OpenSans_700Bold } from "@expo-google-fonts/open-sans";
import { Merriweather_400Regular, Merriweather_700Bold } from "@expo-google-fonts/merriweather";
import { Bitter_700Bold } from "@expo-google-fonts/bitter";
import { Arvo_700Bold } from "@expo-google-fonts/arvo";
import { View } from "react-native";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { BiometricGate } from "./src/components/BiometricGate";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import * as Notifications from "expo-notifications";
import { initNotifications } from "./src/utils/NotificationService";

SplashScreen.preventAutoHideAsync();

// Configure foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  console.log("--- APP STARTING UP ---");
  console.log(`[ENV] __DEV__: ${__DEV__}`);
  const [fontsLoaded] = useFonts({
    Oswald_500Medium,
    Urbanist_400Regular,
    Urbanist_700Bold,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_700Bold,
    Lora_400Regular,
    Lora_700Bold,
    Montserrat_700Bold,
    OpenSans_400Regular,
    OpenSans_700Bold,
    Merriweather_400Regular,
    Merriweather_700Bold,
    Bitter_700Bold,
    Arvo_700Bold,
  });

  useEffect(() => {
    initGlobalHandler();
    initNotifications();
  }, []);

  const onLayoutRootView = React.useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#003631' }} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider onLayout={onLayoutRootView}>
        <ThemeProvider>
          <AuthProvider>
            <BiometricGate>
              <NavigationContainer>
                <StatusBar style="light" translucent backgroundColor="transparent" />
                <MainNavigator />
              </NavigationContainer>
            </BiometricGate>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
