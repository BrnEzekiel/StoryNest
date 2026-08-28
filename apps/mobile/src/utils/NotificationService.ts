import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const initNotifications = async () => {
  try {
    if (Platform.OS === "web") return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== "granted") {
      console.log("[NotificationService] Push notification permissions not granted.");
      return;
    }

    // Android notification channels are only required/supported on Android 8.0+ (API 26+)
    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync("default", {
          name: "StoryNest Alerts",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FFEDA8",
          enableVibrate: true,
          showBadge: true,
          sound: 'notification.wav',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      } catch (channelErr) {
        console.log("[NotificationService] Channel setup skipped/failed on older Android:", channelErr);
      }
    }
  } catch (err) {
    console.log("[NotificationService] init error (handled safely):", err);
  }
};

export const triggerLocalNotification = async (title: string, body: string) => {
  try {
    if (Platform.OS === "web") return;
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'notification.wav',
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { screen: 'ActivityFeed' }
      },
      trigger: null, // Show immediately
    });
  } catch (err) {
    console.log("[NotificationService] trigger notification error:", err);
  }
};
