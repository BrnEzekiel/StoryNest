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
import { View } from "react-native";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Oswald_500Medium,
    Urbanist_400Regular,
    Urbanist_700Bold,
  });

  useEffect(() => {
    initGlobalHandler();

    // Give the runtime a moment to register components before showing the UI
    const timer = setTimeout(() => {
      setIsReady(true);
      if (fontsLoaded) {
        SplashScreen.hideAsync();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  if (!fontsLoaded || !isReady) {
    return <View style={{ flex: 1, backgroundColor: '#003631' }} />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="auto" translucent={false} />
          <MainNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}
