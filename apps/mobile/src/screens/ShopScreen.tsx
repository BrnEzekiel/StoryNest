import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Dimensions } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Zap, Crown, Check, ShoppingCart, Sparkles, Star, Palette, Image as ImageIcon, Frame } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { HeaderWave } from "../components/HeaderWave";

const { width } = Dimensions.get("window");

const COIN_PLANS = [
    { id: 'c1', amount: 100, price: '1.99', color: '#FF9500' },
    { id: 'c2', amount: 500, price: '7.99', color: '#FFCC00', popular: true },
    { id: 'c3', amount: 1200, price: '14.99', color: Colors.accent }
];

const SHOP_ITEMS = [
    { id: 'i1', name: 'Midnight Theme', price: 100, desc: 'A sleek deep-blue theme', icon: Palette, color: '#5856D6' },
    { id: 'i2', name: 'Elite Border', price: 250, desc: 'Golden ring around avatar', icon: Frame, color: '#FFCC00' },
    { id: 'i3', name: 'Custom Icon', price: 500, desc: 'Change your app icon', icon: ImageIcon, color: Colors.accent }
];

export const ShopScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuyCoins = async (plan: any) => {
    setLoading(plan.id);
    try {
        await apiClient.post("/monetization/coins/purchase", { amount: plan.amount, planId: plan.id });
        await refreshUser();
        Alert.alert("Success!", `You've added ${plan.amount} Nest Coins to your satchel.`);
    } catch (e) {
        Alert.alert("Error", "Purchase failed. Please try again.");
    } finally {
        setLoading(null);
    }
  };

  const handleBuyItem = async (item: any) => {
      if ((user?.coins || 0) < item.price) {
          Alert.alert("Need more coins", "You don't have enough coins for this item.");
          return;
      }

      setLoading(item.id);
      try {
          await apiClient.post("/gamification/shop/purchase", { itemId: item.id, price: item.price, name: item.name });
          await refreshUser();
          Alert.alert("Unlocked!", `${item.name} is now yours. You can activate it in settings.`);
      } catch (e) {
          Alert.alert("Error", "Purchase failed.");
      } finally {
          setLoading(null);
      }
  };

  const handleSubscribe = async () => {
    setLoading('sub');
    try {
        await apiClient.post("/monetization/subscribe");
        await refreshUser();
        Alert.alert("Welcome to the Elite! 🎉", "Your Nest Plus subscription is now active.");
    } catch (e) {
        Alert.alert("Error", "Subscription failed. Please try again.");
    } finally {
        setLoading(null);
    }
  };

  const currentBg = isDarkMode ? theme.white : Colors.paleCream;

  return (
    <View style={[styles.container, { backgroundColor: currentBg }]}>
      <StatusBar style="light" />
      <View style={[styles.headerSection, { backgroundColor: Colors.primary, paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.heading }]}>NEST MARKETPLACE</Text>
        <View style={styles.walletBadge}>
            <Zap size={14} color={Colors.accent} fill={Colors.accent} />
            <Text style={[styles.walletText, { fontFamily: fonts.heading }]}>{user?.coins || 0}</Text>
        </View>
        <HeaderWave color={currentBg} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        
        {/* Nest Plus Section */}
        <View style={styles.section}>
            <LinearGradient
                colors={["#003631", "#005a52"]}
                style={[styles.premiumCard, Shadows.m]}
            >
                <View style={styles.premiumHeader}>
                    <Crown size={32} color={Colors.accent} fill={Colors.accent} />
                    <View style={styles.premiumHeaderText}>
                        <Text style={[styles.premiumTitle, { fontFamily: fonts.heading }]}>NEST PLUS</Text>
                        <Text style={[styles.premiumPrice, { fontFamily: fonts.body }]}>$9.99 / month</Text>
                    </View>
                    {user?.isPremium && (
                        <View style={styles.activeBadge}>
                            <Text style={[styles.activeText, { fontFamily: fonts.heading }]}>ACTIVE</Text>
                        </View>
                    )}
                </View>

                <View style={styles.perksList}>
                    {[
                        "Ad-free reading experience",
                        "Unlimited offline downloads",
                        "Exclusive high-fidelity audio stories",
                        "Priority access to new chapters",
                        "Special 'Elite' badge on profile"
                    ].map((perk, i) => (
                        <View key={i} style={styles.perkItem}>
                            <Check size={16} color={Colors.accent} style={{ marginRight: 12 }} />
                            <Text style={[styles.perkText, { fontFamily: fonts.body }]}>{perk}</Text>
                        </View>
                    ))}
                </View>

                {!user?.isPremium && (
                    <TouchableOpacity 
                        style={styles.subBtn} 
                        onPress={handleSubscribe}
                        disabled={loading === 'sub'}
                    >
                        {loading === 'sub' ? <ActivityIndicator color={Colors.primary} /> : (
                            <Text style={[styles.subBtnText, { fontFamily: fonts.heading }]}>JOIN THE ELITE</Text>
                        )}
                    </TouchableOpacity>
                )}
            </LinearGradient>
        </View>

        {/* Feature 45: Achievement Shop */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>ACHIEVEMENT SHOP</Text>
                <Text style={[styles.sectionSub, { fontFamily: fonts.body }]}>Exclusive rewards for dedicated readers</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                {SHOP_ITEMS.map((item) => (
                    <TouchableOpacity 
                        key={item.id} 
                        style={[styles.itemCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : Colors.white }, Shadows.s]}
                        onPress={() => handleBuyItem(item)}
                        disabled={!!loading}
                    >
                        <View style={[styles.itemIconBox, { backgroundColor: item.color + '15' }]}>
                            <item.icon size={24} color={item.color} />
                        </View>
                        <Text style={[styles.itemCardTitle, { color: theme.black, fontFamily: fonts.heading }]}>{item.name}</Text>
                        <View style={styles.itemPriceRow}>
                            <Zap size={12} color={Colors.accent} fill={Colors.accent} />
                            <Text style={[styles.itemPriceText, { color: theme.primary, fontFamily: fonts.heading }]}>{item.price}</Text>
                        </View>
                        {loading === item.id ? <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 10 }} /> : (
                            <View style={[styles.itemBuyBtn, { backgroundColor: theme.primary }]}>
                                <Text style={[styles.itemBuyText, { fontFamily: fonts.heading }]}>BUY</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        {/* Coins Section */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.primary, fontFamily: fonts.heading }]}>NEST COINS</Text>
                <Text style={[styles.sectionSub, { fontFamily: fonts.body }]}>Unlock premium stories and tips authors</Text>
            </View>

            <View style={styles.coinGrid}>
                {COIN_PLANS.map((plan) => (
                    <TouchableOpacity 
                        key={plan.id} 
                        style={[styles.coinCard, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : Colors.white }, Shadows.s]}
                        onPress={() => handleBuyCoins(plan)}
                        disabled={!!loading}
                    >
                        {plan.popular && (
                            <View style={styles.popularBadge}>
                                <Star size={10} color={Colors.primary} fill={Colors.primary} />
                                <Text style={[styles.popularText, { fontFamily: fonts.heading }]}>POPULAR</Text>
                            </View>
                        )}
                        <View style={[styles.coinIconBox, { backgroundColor: plan.color + '15' }]}>
                            <Zap size={24} color={plan.color} fill={plan.color} />
                        </View>
                        <Text style={[styles.coinAmount, { color: theme.black, fontFamily: fonts.heading }]}>{plan.amount}</Text>
                        <Text style={[styles.coinPrice, { fontFamily: fonts.body }]}>${plan.price}</Text>
                        {loading === plan.id ? (
                            <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 12 }} />
                        ) : (
                            <View style={[styles.buyBtn, { backgroundColor: theme.primary }]}>
                                <ShoppingCart size={14} color={theme.white} />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        </View>

        <View style={styles.footer}>
            <Text style={[styles.footerText, { fontFamily: fonts.body }]}>Secure payments via StoryNest Wallet</Text>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingBottom: 60, alignItems: 'center' },
  backBtn: { position: 'absolute', left: 24, top: 60, zIndex: 10 },
  headerTitle: { fontSize: 16, color: Colors.accent, letterSpacing: 2 },
  walletBadge: { position: 'absolute', right: 24, top: 55, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  walletText: { color: Colors.accent, fontSize: 13, marginLeft: 6 },
  content: { flex: 1, padding: 24 },
  section: { marginBottom: 40 },
  sectionHeader: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, letterSpacing: 1 },
  sectionSub: { fontSize: 12, color: Colors.mutedTeal, marginTop: 4 },
  premiumCard: { borderRadius: 32, padding: 32 },
  premiumHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  premiumHeaderText: { marginLeft: 20, flex: 1 },
  premiumTitle: { color: Colors.accent, fontSize: 24, letterSpacing: 2 },
  premiumPrice: { color: Colors.paleGreen, fontSize: 14, opacity: 0.8 },
  activeBadge: { backgroundColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  activeText: { color: Colors.primary, fontSize: 10 },
  perksList: { marginBottom: 40 },
  perkItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  perkText: { color: Colors.white, fontSize: 14, opacity: 0.9 },
  subBtn: { backgroundColor: Colors.accent, paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  subBtnText: { color: Colors.primary, fontSize: 14, letterSpacing: 1 },
  coinGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  coinCard: { width: (width - 64) / 3, padding: 20, borderRadius: 24, alignItems: 'center', position: 'relative' },
  popularBadge: { position: 'absolute', top: -10, backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  popularText: { fontSize: 8, color: Colors.primary, marginLeft: 4 },
  coinIconBox: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  coinAmount: { fontSize: 20, marginBottom: 2 },
  coinPrice: { fontSize: 12, color: Colors.mutedTeal, marginBottom: 12 },
  buyBtn: { padding: 8, borderRadius: 10 },
  itemCard: { width: 140, padding: 20, borderRadius: 24, marginRight: 16, alignItems: 'center' },
  itemIconBox: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  itemCardTitle: { fontSize: 13, textAlign: 'center', marginBottom: 6 },
  itemPriceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  itemPriceText: { fontSize: 12, marginLeft: 4 },
  itemBuyBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  itemBuyText: { color: Colors.white, fontSize: 10 },
  footer: { alignItems: 'center', marginTop: 10 },
  footerText: { fontSize: 11, color: Colors.mutedTeal, opacity: 0.6 }
});
