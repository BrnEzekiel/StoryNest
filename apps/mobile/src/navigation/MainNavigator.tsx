import React, { useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Home, BookOpen, Headphones, MessageCircle, Bell, User } from "lucide-react-native";
import { Colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Selection } from "../utils/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { NotificationDot } from "../components/NotificationDot";

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
import { PremiumScreen } from "../screens/PremiumScreen";
import { ReferralScreen } from "../screens/ReferralScreen";
import { ActivityFeedScreen } from "../screens/ActivityFeedScreen";
import { PodcastsScreen } from "../screens/PodcastsScreen";

import * as SplashScreen from "expo-splash-screen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/** Read tab = library + explore discovery */
const ReadHub = ExploreScreen;

const TabNavigator = () => {
  const { tabOrder, fonts } = useTheme();
  const { hasUnreadMessages } = useAuth();
  const insets = useSafeAreaInsets();

  const renderTabIcon = (name: string, color: string) => {
    const size = 22;
    return (
      <View>
        {name === "Home" && <Home color={color} size={size} />}
        {name === "Read" && <BookOpen color={color} size={size} />}
        {name === "Podcasts" && <Headphones color={color} size={size} />}
        {name === "Chat" && <MessageCircle color={color} size={size} />}
        {name === "Activity" && <Bell color={color} size={size} />}
        {(name === "Chat" || name === "Activity") && hasUnreadMessages && <NotificationDot />}
      </View>
    );
  };

  const getScreenComponent = (name: string) => {
    if (name === "Home") return HomeScreen;
    if (name === "Read") return ReadHub;
    if (name === "Podcasts") return PodcastsScreen;
    if (name === "Chat") return MessagesScreen;
    if (name === "Activity") return ActivityFeedScreen;
    return HomeScreen;
  };

  return (
    <Tab.Navigator
      screenListeners={{
        state: () => {
          Selection();
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }: any) =>
          renderTabIcon(route.name, focused ? "#003631" : "#7db8b2"),
        tabBarActiveTintColor: "#003631",
        tabBarInactiveTintColor: "#7db8b2",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "rgba(0,0,0,0.08)",
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          elevation: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.heading,
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        },
      })}
    >
      {tabOrder.map((name) => (
        <Tab.Screen key={name} name={name} component={getScreenComponent(name)} />
      ))}
    </Tab.Navigator>
  );
};

export const MainNavigator = ({ onReady }: { onReady: () => void }) => {
  const { user, loading } = useAuth();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (!loading) {
      onReady?.();
      SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: "#003631" }} />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDarkMode ? "#121212" : "#003631" },
        animation: "slide_from_right",
        animationDuration: 400,
        gestureEnabled: true,
        gestureDirection: "horizontal",
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
          <Stack.Screen name="Reader" component={StoryReaderScreen} options={{ animation: "fade_from_bottom" }} />
          <Stack.Screen name="Admin" component={AdminScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="CreativeSuite" component={CreativeSuiteScreen} />
          <Stack.Screen name="ManageChapters" component={ManageChaptersScreen} />
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="AuthorAnalytics" component={AuthorAnalyticsScreen} />
          <Stack.Screen name="Premium" component={PremiumScreen} />
          <Stack.Screen name="Referral" component={ReferralScreen} />
          <Stack.Screen name="ActivityFeed" component={ActivityFeedScreen} />
          <Stack.Screen name="Explore" component={ExploreScreen} />
          <Stack.Screen name="Bookmarks" component={BookmarksScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
