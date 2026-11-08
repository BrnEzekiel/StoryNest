import React, { useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput } from "react-native";
import { Colors } from "../theme/colors";
import { X, Flag } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useTheme } from "../context/ThemeContext";
import { useNotice } from "../context/NoticeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const REASONS = ["Spam", "Harassment", "Hate speech", "Explicit content", "Plagiarism", "Misinformation", "Other"];

interface Props {
  visible: boolean;
  onClose: () => void;
  targetType: "story" | "comment" | "user" | "chapter";
  targetId: string;
  targetTitle?: string;
}

export const ReportSheet = ({ visible, onClose, targetType, targetId, targetTitle }: Props) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts } = useTheme();
  const { showNotice } = useNotice();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!reason || sending) return;
    setSending(true);
    try {
      await apiClient.post("/reports", { targetType, targetId, reason, details: details.trim() });
      showNotice({ title: "Report sent", message: "Our moderators will review it. Thank you.", variant: "success" });
      setReason(null);
      setDetails("");
      onClose();
    } catch (e) {
      showNotice({ title: "Error", message: "Could not send the report.", variant: "error" });
    } finally { setSending(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.white, paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Flag size={18} color={Colors.error} />
              <Text style={[styles.title, { color: theme.black, fontFamily: fonts.heading }]}>REPORT {targetType.toUpperCase()}</Text>
            </View>
            <TouchableOpacity onPress={onClose}><X size={22} color={theme.black} /></TouchableOpacity>
          </View>
          {!!targetTitle && <Text style={[styles.target, { fontFamily: fonts.body }]} numberOfLines={1}>{targetTitle}</Text>}
          <Text style={[styles.label, { fontFamily: fonts.heading }]}>WHY ARE YOU REPORTING THIS?</Text>
          <View style={styles.reasonWrap}>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonChip, reason === r && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => setReason(r)}
              >
                <Text style={[styles.reasonText, { fontFamily: fonts.body }, reason === r && { color: Colors.accent }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.details, { fontFamily: fonts.body, color: theme.black }]}
            placeholder="Extra details (optional)"
            placeholderTextColor={Colors.mutedTeal}
            value={details}
            onChangeText={setDetails}
            multiline
          />
          <TouchableOpacity
            style={[styles.submit, { backgroundColor: theme.primary, opacity: !reason || sending ? 0.5 : 1 }]}
            disabled={!reason || sending}
            onPress={handleSubmit}
          >
            <Text style={[styles.submitText, { fontFamily: fonts.heading }]}>{sending ? "SENDING..." : "SUBMIT REPORT"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 16, letterSpacing: 1, marginLeft: 10 },
  target: { fontSize: 13, color: Colors.mutedTeal, marginBottom: 12 },
  label: { fontSize: 11, letterSpacing: 1, color: Colors.mutedTeal, marginBottom: 10 },
  reasonWrap: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  reasonChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, borderWidth: 1, borderColor: Colors.paleGreen, marginRight: 8, marginBottom: 8 },
  reasonText: { fontSize: 12 },
  details: { minHeight: 70, maxHeight: 120, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.04)", padding: 14, fontSize: 14, textAlignVertical: "top", marginBottom: 16 },
  submit: { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  submitText: { fontSize: 12, color: Colors.accent, letterSpacing: 1 },
});
