import React, { useEffect, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Home, Compass, Bookmark, User } from "lucide-react-native";
import { Colors } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Selection } from "../utils/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dimensions, View } from "react-native";
import { NotificationDot } from "../components/NotificationDot";

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
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = () => {
  const { isDarkMode, tabOrder, theme, fonts } = useTheme();
  const { hasUnreadMessages } = useAuth();
  const insets = useSafeAreaInsets();

  const renderTabIcon = (name: string, color: string) => {
    const size = 24;
    return (
        <View>
            {name === "Home" && <Home color={color} size={size} />}
            {name === "Explore" && <Compass color={color} size={size} />}
            {name === "Saved" && <Bookmark color={color} size={size} />}
            {name === "Profile" && <User color={color} size={size} />}
            {name === "Profile" && hasUnreadMessages && <NotificationDot />}
        </View>
    );
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
      screenListeners={{
        state: (e) => {
          Selection();
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }: any) => renderTabIcon(route.name, focused ? "#003631" : "#7db8b2"),
        tabBarActiveTintColor: "#003631",
        tabBarInactiveTintColor: "#7db8b2",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "rgba(0,0,0,0.1)",
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom + 10,
          paddingTop: 10,
          position: 'absolute',
          elevation: 30,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.2,
          shadowRadius: 15,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.heading,
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 5,
        },
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
