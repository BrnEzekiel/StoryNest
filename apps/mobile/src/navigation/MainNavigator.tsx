import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DefaultTheme } from "@react-navigation/native";
import { Home, Compass, Bookmark, User } from "lucide-react-native";
import { Colors } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

// Screens
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { SignupScreen } from "../screens/SignupScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ExploreScreen } from "../screens/ExploreScreen";
import { BookmarksScreen } from "../screens/BookmarksScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { AdminScreen } from "../screens/AdminScreen";
import { StoryReaderScreen } from "../screens/StoryReaderScreen";
import { SettingsScreen } from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Custom Theme to kill the white background once and for all
export const StoryNestTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.primary,
    card: Colors.white,
    text: Colors.primary,
  },
};

const TabNavigator = () => {
  const { isDarkMode } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === "Home") return <Home color={color} size={size} />;
          if (route.name === "Explore") return <Compass color={color} size={size} />;
          if (route.name === "Saved") return <Bookmark color={color} size={size} />;
          if (route.name === "Profile") return <User color={color} size={size} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.mutedTeal,
        tabBarStyle: {
          backgroundColor: isDarkMode ? "#1a2e2c" : Colors.white,
          borderTopColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen,
          height: 60,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.body,
          fontSize: 11,
        },
        headerShown: false,
        // Liquid Transition Logic (Impeccable #21)
        animation: 'fade',
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.navigate("Home", { reset: true });
          },
        })}
      />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Saved" component={BookmarksScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export const MainNavigator = () => {
  const { user, loading } = useAuth();
  const { isDarkMode } = useTheme();

  if (loading) return null;

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false, 
        contentStyle: { backgroundColor: isDarkMode ? "#121212" : Colors.primary },
        animation: 'slide_from_right'
      }}
    >
      {!user ? (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="Reader" component={StoryReaderScreen} options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="Admin" component={AdminScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
