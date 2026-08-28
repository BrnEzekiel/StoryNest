import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../theme/colors";

export type ThemeMode = "light" | "dark" | "sepia" | "solarized" | "oled";
export type FontPreference = "default" | "serif" | "modern" | "classic" | "dyslexic";

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  fontPreference: FontPreference;
  setFontPreference: (pref: FontPreference) => void;
  tabOrder: string[];
  setTabOrder: (order: string[]) => void;
  isDarkMode: boolean;
  theme: typeof Colors;
  fonts: {
    logo: string;
    heading: string;
    body: string;
    bodyBold: string;
  };
  recsEnabled: boolean;
  setRecsEnabled: (val: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DEFAULT_TAB_ORDER = ["Home", "Explore", "Saved", "Profile"];

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [fontPreference, setFontPreferenceState] = useState<FontPreference>("default");
  const [tabOrder, setTabOrderState] = useState<string[]>(DEFAULT_TAB_ORDER);
  const [recsEnabled, setRecsEnabledState] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedMode = await AsyncStorage.getItem("themeMode") as ThemeMode;
      const savedFont = await AsyncStorage.getItem("fontPreference") as FontPreference;
      const savedTabs = await AsyncStorage.getItem("tabOrder");
      const re = await AsyncStorage.getItem("recsEnabled");

      if (savedMode) setThemeModeState(savedMode);
      if (savedFont) setFontPreferenceState(savedFont);
      if (savedTabs) setTabOrderState(JSON.parse(savedTabs));
      if (re !== null) setRecsEnabledState(re === "true");
    } catch (e) {
      console.log("Failed to load settings");
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem("themeMode", mode);
  };

  const setFontPreference = async (pref: FontPreference) => {
    setFontPreferenceState(pref);
    await AsyncStorage.setItem("fontPreference", pref);
  };

  const setTabOrder = async (order: string[]) => {
      setTabOrderState(order);
      await AsyncStorage.setItem("tabOrder", JSON.stringify(order));
  };

  const setRecsEnabled = async (val: boolean) => {
    setRecsEnabledState(val);
    await AsyncStorage.setItem("recsEnabled", val.toString());
  };

  const isDarkMode = themeMode === "dark" || themeMode === "oled";

  const getTheme = () => {
    switch (themeMode) {
      case "dark":
        return {
          ...Colors,
          white: "#121212",
          black: "#FFFFFF",
          paleGreen: "#1a2e2c",
          primary: "#FFEDA8",
          darkTextGreen: "#FFEDA8",
        };
      case "oled":
        return {
          ...Colors,
          white: "#000000",
          black: "#FFFFFF",
          paleGreen: "#050505",
          primary: "#FFEDA8",
          darkTextGreen: "#FFEDA8",
        };
      case "sepia":
        return {
          ...Colors,
          white: "#f4ecd8",
          black: "#433422",
          primary: "#5f4b32",
          paleGreen: "#e9dfc4",
          darkTextGreen: "#5f4b32",
        };
      case "solarized":
        return {
          ...Colors,
          white: "#fdf6e3",
          black: "#073642",
          primary: "#268bd2",
          paleGreen: "#eee8d5",
          darkTextGreen: "#002b36",
        };
      default:
        return Colors;
    }
  };

  const getFonts = () => {
    // Standardize on brand fonts for stability on older devices
    return {
      logo: "Oswald_500Medium",
      heading: "Oswald_500Medium",
      body: "Urbanist_400Regular",
      bodyBold: "Urbanist_700Bold",
    };
  };

  return (
    <ThemeContext.Provider value={{ 
      themeMode, 
      setThemeMode, 
      fontPreference,
      setFontPreference,
      tabOrder,
      setTabOrder,
      isDarkMode, 
      theme: getTheme(), 
      fonts: getFonts(),
      recsEnabled, 
      setRecsEnabled 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
