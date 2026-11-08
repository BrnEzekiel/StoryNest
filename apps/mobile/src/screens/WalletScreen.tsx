import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Colors } from "../theme/colors";
import { ArrowLeft, Coins, ArrowUpCircle, ArrowDownCircle } from "lucide-react-native";
import apiClient from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useCachedQuery } from "../hooks/useCachedQuery";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const TYPE_COPY: Record<string, { label: string; out: boolean }> = {
  STORY: { label: "Story unlock", out: true },
  COINS: { label: "Coin purchase", out: false },
  SUBSCRIPTION: { label: "Subscription", out: true },
  TIP: { label: "Tip sent", out: true },
};

export const WalletScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();

  const txQuery = useCachedQuery<any[]>("wallet:txns", async () => {
    const res = await apiClient.get("/users/me/purchases");
    return res.data;
  });
  const txns = txQuery.data || [];

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>COIN WALLET</Text>
        <View style={{ width: 24, marginLeft: 16 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={txQuery.refreshing} onRefresh={() => txQuery.refresh({ showIndicator: true })} tintColor={Colors.accent} />}
      >
        <View style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
          <Coins size={28} color="#D4AF37" />
          <Text style={[styles.balanceValue, { fontFamily: fonts.heading }]}>{user?.coins || 0}</Text>
          <Text style={[styles.balanceLabel, { fontFamily: fonts.body }]}>STORY COINS</Text>
        </View>

        <View style={[styles.earnCard, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : Colors.paleGreen }]}>
          <Text style={[styles.earnTitle, { fontFamily: fonts.heading, color: theme.primary }]}>EARN MORE</Text>
          <Text style={[styles.earnText, { fontFamily: fonts.body }]}>
            Finish weekly challenges, complete the season pass, and refer friends to earn coins. Spend them on story unlocks, tips, and streak freezes.
          </Text>
          <TouchableOpacity style={[styles.earnBtn, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate("Challenges")}>
            <Text style={[styles.earnBtnText, { fontFamily: fonts.heading }]}>VIEW CHALLENGES</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { fontFamily: fonts.heading, color: theme.primary }]}>HISTORY</Text>
        {txns.length === 0 ? (
          <Text style={[styles.emptyText, { fontFamily: fonts.body }]}>No transactions yet.</Text>
        ) : txns.map((t: any) => {
          const meta = TYPE_COPY[t.type] || { label: t.type, out: true };
          return (
            <View key={t.id} style={[styles.txRow, { borderBottomColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
              {meta.out
                ? <ArrowUpCircle size={22} color={Colors.error} />
                : <ArrowDownCircle size={22} color="#34C759" />}
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.txTitle, { color: theme.black, fontFamily: fonts.heading }]}>{meta.label}</Text>
                <Text style={[styles.txSub, { fontFamily: fonts.body }]} numberOfLines={1}>
                  {t.storyTitle || t.reference || new Date(t.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[styles.txAmount, { fontFamily: fonts.heading, color: meta.out ? Colors.error : "#34C759" }]}>
                {meta.out ? "-" : "+"}{t.amount} {t.currency}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 24, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  headerTitle: { fontSize: 18, color: Colors.accent, letterSpacing: 1, flex: 1, textAlign: "center" },
  backBtn: { marginRight: 16 },
  content: { flex: 1, padding: 24 },
  balanceCard: { borderRadius: 20, padding: 28, alignItems: "center", marginBottom: 16 },
  balanceValue: { fontSize: 44, color: "#FFEDA8", marginTop: 8 },
  balanceLabel: { fontSize: 11, color: Colors.mutedTeal, letterSpacing: 2, marginTop: 4 },
  earnCard: { borderRadius: 16, padding: 18, marginBottom: 24 },
  earnTitle: { fontSize: 13, letterSpacing: 1, marginBottom: 6 },
  earnText: { fontSize: 13, lineHeight: 20, opacity: 0.85 },
  earnBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 14 },
  earnBtnText: { fontSize: 11, color: Colors.accent, letterSpacing: 1 },
  sectionTitle: { fontSize: 13, letterSpacing: 1.5, marginBottom: 8 },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  txTitle: { fontSize: 14 },
  txSub: { fontSize: 12, color: Colors.mutedTeal, marginTop: 2 },
  txAmount: { fontSize: 13, marginLeft: 10 },
  emptyText: { fontSize: 14, color: Colors.mutedTeal, textAlign: "center", marginTop: 24 },
});
