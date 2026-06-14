import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const initNotifications = async () => {
  if (Platform.OS === "web") return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== "granted") {
    console.log("Failed to get push token for push notification!");
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FFEDA8",
    });
  }
};

export const triggerLocalNotification = async (title: string, body: string) => {
    if (Platform.OS === "web") return;
    
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true, // This tells the OS to use the default notification sound
            priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
    });
};
