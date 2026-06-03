import React, { useEffect, useState } from "react";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { Home, Compass, Bookmark, User } from "lucide-react-native";
import { Colors } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Selection } from "../utils/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Screens
import { LoginScreen } from "../screens/LoginScreen";
import { SignupScreen } from "../screens/SignupScreen";
import { OTPScreen } from "../screens/OTPScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { ResetPasswordScreen } from "../screens/ResetPasswordScreen";
import { LegalScreen } from "../screens/LegalScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ExploreScreen } from "../screens/ExploreScreen";
import { BookmarksScreen } from "../screens/BookmarksScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { AdminScreen } from "../screens/AdminScreen";
import { StoryReaderScreen } from "../screens/StoryReaderScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { UserProfileScreen } from "../screens/UserProfileScreen";
import { CreativeSuiteScreen } from "../screens/CreativeSuiteScreen";
import { ManageChaptersScreen } from "../screens/ManageChaptersScreen";
import { MessagesScreen } from "../screens/MessagesScreen";
import { AuthorAnalyticsScreen } from "../screens/AuthorAnalyticsScreen";

const { width } = Dimensions.get("window");
const Tab = createMaterialTopTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = () => {
  const { isDarkMode, tabOrder } = useTheme();
  const insets = useSafeAreaInsets();

  const renderTabIcon = (name: string, color: string) => {
    const size = 22;
    if (name === "Home") return <Home color={color} size={size} />;
    if (name === "Explore") return <Compass color={color} size={size} />;
    if (name === "Saved") return <Bookmark color={color} size={size} />;
    if (name === "Profile") return <User color={color} size={size} />;
    return null;
  };

  const getScreenComponent = (name: string) => {
    if (name === "Home") return HomeScreen;
    if (name === "Explore") return ExploreScreen;
    if (name === "Saved") return BookmarksScreen;
    if (name === "Profile") return ProfileScreen;
    return HomeScreen;
  };

  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      screenListeners={{
        state: (e) => {
          Selection();
        },
      }}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }: any) => renderTabIcon(route.name, color),
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.mutedTeal,
        tabBarPressColor: 'transparent',
        tabBarIndicatorStyle: {
          top: 0,
          backgroundColor: Colors.primary,
          height: 3,
          width: 40,
          marginLeft: (width / 4 - 40) / 2,
          borderRadius: 2,
        },
        tabBarStyle: {
          backgroundColor: isDarkMode ? "#1a2e2c" : Colors.white,
          borderTopColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen,
          height: 65 + insets.bottom,
          paddingBottom: insets.bottom + 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.body,
          fontSize: 10,
          textTransform: 'none',
        },
        tabBarShowIcon: true,
        swipeEnabled: true,
      })}
    >
      {tabOrder.map(name => (
          <Tab.Screen key={name} name={name} component={getScreenComponent(name)} />
      ))}
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
        animation: 'slide_from_right',
        animationDuration: 400,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
      initialRouteName={!user ? "Login" : "Main"}
    >
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="OTP" component={OTPScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <Stack.Screen name="Legal" component={LegalScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="Reader" component={StoryReaderScreen} options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="Admin" component={AdminScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="CreativeSuite" component={CreativeSuiteScreen} />
          <Stack.Screen name="ManageChapters" component={ManageChaptersScreen} />
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="AuthorAnalytics" component={AuthorAnalyticsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
