import { Linking, Alert, Platform } from "react-native";

export const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029VbDZcNF0gcfHzI9W812R";

/**
 * Opens the official StoryNest WhatsApp Channel.
 * Attempts native WhatsApp app first, with web fallback.
 */
export const openWhatsAppChannel = async () => {
  try {
    const canOpen = await Linking.canOpenURL(WHATSAPP_CHANNEL_URL);
    if (canOpen || Platform.OS === 'web') {
      await Linking.openURL(WHATSAPP_CHANNEL_URL);
    } else {
      await Linking.openURL(WHATSAPP_CHANNEL_URL);
    }
  } catch (err) {
    console.log("[WhatsApp] Error opening channel:", err);
    try {
      await Linking.openURL(WHATSAPP_CHANNEL_URL);
    } catch (e) {
      Alert.alert(
        "WhatsApp Channel",
        "Could not open WhatsApp. Please visit https://whatsapp.com/channel/0029VbDZcNF0gcfHzI9W812R in your browser."
      );
    }
  }
};
