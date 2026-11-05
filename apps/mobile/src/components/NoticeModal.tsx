import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from "react-native";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react-native";
import { Colors } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";

export type NoticeVariant = "error" | "info" | "success";

export interface NoticeAction {
  label: string;
  onPress?: () => void;
  kind?: "primary" | "ghost" | "destructive";
}

interface NoticeModalProps {
  visible: boolean;
  title: string;
  message?: string;
  variant?: NoticeVariant;
  actions?: NoticeAction[];
  onDismiss: () => void;
}

const VARIANT_STYLE: Record<NoticeVariant, { icon: React.ReactNode; tint: string; color: string }> = {
  error: {
    icon: <AlertTriangle size={26} color="#C0392B" />,
    tint: "rgba(192,57,43,0.10)",
    color: "#C0392B",
  },
  info: {
    icon: <Info size={26} color={Colors.primary} />,
    tint: "rgba(0,54,49,0.08)",
    color: Colors.primary,
  },
  success: {
    icon: <CheckCircle2 size={26} color="#27AE60" />,
    tint: "rgba(39,174,96,0.10)",
    color: "#27AE60",
  },
};

/**
 * Branded replacement for the native Alert dialog: forest-and-gold card,
 * variant icon, stacked actions. Used for errors, notices, confirmations,
 * and option pickers alike.
 */
export const NoticeModal: React.FC<NoticeModalProps> = ({
  visible,
  title,
  message,
  variant = "info",
  actions,
  onDismiss,
}) => {
  const { theme, fonts, isDarkMode } = useTheme();
  const vs = VARIANT_STYLE[variant];
  const buttons: NoticeAction[] = actions && actions.length > 0
    ? actions
    : [{ label: "OK", kind: "primary" }];

  const press = (action: NoticeAction) => {
    onDismiss();
    // Run the action after dismissal so navigation/reloads don't fight the modal.
    setTimeout(() => action.onPress?.(), 30);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onDismiss} />
        <View style={[styles.card, { backgroundColor: theme.white }]}>
          <View style={[styles.iconWrap, { backgroundColor: vs.tint }]}>{vs.icon}</View>
          <Text style={[styles.title, { fontFamily: fonts.heading, color: theme.black }]}>
            {title}
          </Text>
          {!!message && (
            <Text style={[styles.message, { fontFamily: fonts.body, color: isDarkMode ? "rgba(255,255,255,0.65)" : Colors.mutedTeal }]}>
              {message}
            </Text>
          )}
          <View style={styles.actions}>
            {buttons.map((b, i) => (
              <TouchableOpacity
                key={`${b.label}-${i}`}
                style={[
                  styles.btn,
                  b.kind === "primary" && { backgroundColor: Colors.primary },
                  b.kind === "ghost" && {
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,54,49,0.25)",
                  },
                  b.kind === "destructive" && { backgroundColor: "rgba(192,57,43,0.12)" },
                ]}
                onPress={() => press(b)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.btnText,
                    { fontFamily: fonts.heading },
                    b.kind === "primary" && { color: Colors.accent },
                    b.kind === "ghost" && { color: theme.black },
                    b.kind === "destructive" && { color: "#C0392B" },
                    !b.kind && { color: Colors.accent },
                  ]}
                >
                  {b.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 19, letterSpacing: 0.5, textAlign: "center", marginBottom: 10 },
  message: { fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 24 },
  actions: { width: "100%", gap: 12 },
  btn: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: Colors.primary,
  },
  btnText: { fontSize: 14, letterSpacing: 1 },
});
