import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../theme/colors";

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  recsEnabled: boolean;
  setRecsEnabled: (val: boolean) => void;
  theme: typeof Colors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [recsEnabled, setRecsEnabledState] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const dm = await AsyncStorage.getItem("isDarkMode");
      const re = await AsyncStorage.getItem("recsEnabled");
      if (dm !== null) setIsDarkMode(dm === "true");
      if (re !== null) setRecsEnabledState(re === "true");
    } catch (e) {
      console.log("Failed to load settings");
    }
  };

  const toggleDarkMode = async () => {
    const newVal = !isDarkMode;
    setIsDarkMode(newVal);
    await AsyncStorage.setItem("isDarkMode", newVal.toString());
  };

  const setRecsEnabled = async (val: boolean) => {
    setRecsEnabledState(val);
    await AsyncStorage.setItem("recsEnabled", val.toString());
  };

  const theme = isDarkMode ? {
    ...Colors,
    white: "#121212", // Dark surface
    black: "#FFFFFF",
    paleGreen: "#1a2e2c",
    darkTextGreen: "#FFEDA8", // Gold text in dark mode
    darkTextCream: "#FFEDA8",
  } : Colors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, recsEnabled, setRecsEnabled, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
