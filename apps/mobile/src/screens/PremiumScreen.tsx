import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert, ActivityIndicator } from "react-native";
import { Colors } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Zap, CheckCircle2, ShieldCheck, Star, Sparkles } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
// @ts-ignore
import { Paystack } from 'react-native-paystack-webview';
import apiClient from "../api/apiClient";

const { width } = Dimensions.get("window");

export const PremiumScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { theme, fonts } = useTheme();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const perks = [
    "Unlimited access to all premium stories",
    "Exclusive 'Pioneer' badge on your profile",
    "Ad-free reading experience",
    "500 bonus Nest Coins every month",
    "Early access to new features and world-building tools",
  ];

  const handlePaymentSuccess = async (res: any) => {
      setLoading(true);
      try {
          const { transactionRef } = res;
          await apiClient.post("/payments/verify", { reference: transactionRef.reference });
          await refreshUser();
          Alert.alert("Success", "Welcome to StoryNest Premium! Your account has been upgraded.");
          navigation.goBack();
      } catch (e) {
          Alert.alert("Verification Error", "We couldn't verify your payment. Please contact support.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#001a18', '#000807']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>PREMIUM UPGRADE</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
              <View style={styles.iconHUD}>
                  <Sparkles size={48} color={Colors.accent} />
              </View>
              <Text style={[styles.heroTitle, { fontFamily: fonts.heading }]}>UNLEASH THE NEST</Text>
              <Text style={[styles.heroSub, { fontFamily: fonts.body }]}>Unlock the full potential of your imagination.</Text>
          </View>

          <View style={styles.perksList}>
              {perks.map((perk, i) => (
                  <View key={i} style={styles.perkItem}>
                      <CheckCircle2 size={20} color={Colors.accent} />
                      <Text style={[styles.perkText, { fontFamily: fonts.body }]}>{perk}</Text>
                  </View>
              ))}
          </View>

          <View style={styles.pricingCard}>
              <LinearGradient colors={['rgba(255, 237, 168, 0.15)', 'rgba(255, 237, 168, 0.05)']} style={styles.pricingGradient}>
                  <Text style={[styles.planName, { fontFamily: fonts.heading }]}>MONTHLY ACCESS</Text>
                  <View style={styles.priceRow}>
                      <Text style={[styles.currency, { fontFamily: fonts.body }]}>KES</Text>
                      <Text style={[styles.price, { fontFamily: fonts.heading }]}>499</Text>
                      <Text style={[styles.period, { fontFamily: fonts.body }]}>/mo</Text>
                  </View>
                  <Text style={[styles.pricingSub, { fontFamily: fonts.body }]}>Cancel anytime. No hidden fees.</Text>
              </LinearGradient>
          </View>

          {loading ? <ActivityIndicator color={Colors.accent} size="large" style={{ marginTop: 20 }} /> : (
              <View style={styles.btnWrapper}>
                <Paystack  
                    paystackKey="pk_live_efc960f0010feefe0610d7e422324a0197edae1e"
                    amount={'499.00'}
                    billingEmail={user?.email || "guest@storynest.com"}
                    activityIndicatorColor={Colors.accent}
                    onCancel={() => {}}
                    onSuccess={handlePaymentSuccess}
                    autoStart={false}
                    renderButton={({ onPress }: any) => (
                        <TouchableOpacity style={styles.upgradeBtn} onPress={onPress}>
                            <Zap size={20} color={Colors.primary} />
                            <Text style={[styles.upgradeText, { fontFamily: fonts.heading }]}>INITIALIZE PREMIUM</Text>
                        </TouchableOpacity>
                    )}
                />
              </View>
          )}

          <View style={styles.securityNote}>
              <ShieldCheck size={16} color={Colors.mutedTeal} />
              <Text style={[styles.securityText, { fontFamily: fonts.body }]}>SECURE TRANSACTIONS VIA PAYSTACK</Text>
          </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,237,168,0.1)' },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 14, color: Colors.accent, letterSpacing: 3 },
  content: { flex: 1, padding: 24 },
  heroSection: { alignItems: 'center', marginVertical: 32 },
  iconHUD: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,237,168,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,237,168,0.3)', marginBottom: 24 },
  heroTitle: { fontSize: 28, color: Colors.white, letterSpacing: 2, textAlign: 'center' },
  heroSub: { fontSize: 14, color: Colors.mutedTeal, textAlign: 'center', marginTop: 8 },
  perksList: { marginBottom: 40 },
  perkItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  perkText: { flex: 1, marginLeft: 16, color: Colors.white, fontSize: 14, opacity: 0.8 },
  pricingCard: { borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,237,168,0.2)', marginBottom: 32 },
  pricingGradient: { padding: 32, alignItems: 'center' },
  planName: { fontSize: 12, color: Colors.accent, letterSpacing: 3, marginBottom: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  currency: { color: Colors.white, fontSize: 16, marginBottom: 6, marginRight: 4, opacity: 0.6 },
  price: { color: Colors.white, fontSize: 48 },
  period: { color: Colors.white, fontSize: 16, marginBottom: 8, opacity: 0.6 },
  pricingSub: { fontSize: 12, color: Colors.mutedTeal },
  btnWrapper: { marginBottom: 24 },
  upgradeBtn: { backgroundColor: Colors.accent, height: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  upgradeText: { color: Colors.primary, fontSize: 14, letterSpacing: 2, fontWeight: 'bold' },
  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 60 },
  securityText: { fontSize: 10, color: Colors.mutedTeal, letterSpacing: 1 }
});
