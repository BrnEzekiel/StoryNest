import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Share,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Copy,
  Share2,
  Gift,
  Coins,
  Users,
  CheckCircle2,
  MessageCircle,
  Sparkles,
  Award,
  Crown,
  Zap,
  Check,
} from "lucide-react-native";
import { Colors, Shadows, Radii } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import apiClient from "../api/apiClient";
import { openWhatsAppChannel, WHATSAPP_CHANNEL_URL } from "../utils/whatsapp";

const { width } = Dimensions.get("window");

export const ReferralScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { theme, fonts, isDarkMode } = useTheme();

  const [loading, setLoading] = useState(true);
  const [referralInfo, setReferralInfo] = useState<{
    referralCode: string;
    referralLink: string;
    totalReferred: number;
    coinsEarned: number;
    rewardPerReferral: number;
    userBonus: number;
    requiredForPremium: number;
    remainingForPremium: number;
    isPremiumUnlocked: boolean;
    hasBeenReferred: boolean;
    referredUsers: Array<{ id: string; username: string; createdAt: string }>;
  } | null>(null);

  const [inputCode, setInputCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralInfo();
  }, []);

  const fetchReferralInfo = async () => {
    try {
      const res = await apiClient.get("/referrals/info");
      setReferralInfo(res.data);
    } catch (e: any) {
      console.log("[Referral] Failed to fetch info:", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!referralInfo?.referralCode) return;
    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(referralInfo.referralCode);
      } else {
        await Share.share({
          message: `Join me on StoryNest! Use my code: ${referralInfo.referralCode}\nJoin our WhatsApp Channel: ${WHATSAPP_CHANNEL_URL}`,
        });
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      Alert.alert("Code", referralInfo.referralCode);
    }
  };

  const handleShare = async () => {
    const code = referralInfo?.referralCode || user?.username || "STORYNEST";
    const shareMessage = `🌟 Discover thrilling stories on StoryNest!\n\nUse my invite code 👉 ${code} 👈 to get 25 FREE Story Coins & 50 XP!\n\nJoin our community on WhatsApp: ${WHATSAPP_CHANNEL_URL}`;
    try {
      await Share.share({
        title: "Join StoryNest",
        message: shareMessage,
      });
    } catch (err: any) {
      console.log("[Share Error]", err);
    }
  };

  const handleClaimCode = async () => {
    if (!inputCode.trim()) {
      Alert.alert("Required", "Please enter a referral code.");
      return;
    }
    setClaiming(true);
    try {
      const res = await apiClient.post("/referrals/claim", {
        referralCode: inputCode.trim(),
      });
      Alert.alert("🎉 Success!", res.data.message || "25 Story Coins credited to your account!");
      setInputCode("");
      await refreshUser();
      await fetchReferralInfo();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error || "Could not apply referral code. Please check and try again.";
      Alert.alert("Referral Error", errorMsg);
    } finally {
      setClaiming(false);
    }
  };

  const totalReferred = referralInfo?.totalReferred || 0;
  const requiredCount = 10;
  const isPremiumActive = user?.isPremium || referralInfo?.isPremiumUnlocked || totalReferred >= requiredCount;
  const progressPercent = Math.min(100, Math.round((totalReferred / requiredCount) * 100));
  const remainingCount = Math.max(0, requiredCount - totalReferred);

  const currentBg = isDarkMode ? "#121212" : "#F7F5F0";

  return (
    <View style={[styles.container, { backgroundColor: currentBg }]}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={["#003631", "#004D46"]}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={24} color={Colors.accent} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { fontFamily: fonts.heading }]}>
            REFER & EARN
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.headerHero}>
          <View style={styles.giftIconCircle}>
            <Crown size={36} color={Colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { fontFamily: fonts.heading }]}>
            10 Referrals Unlocks Premium
          </Text>
          <Text style={[styles.heroSub, { fontFamily: fonts.body }]}>
            Invite 10 friends to unlock <Text style={{ color: Colors.accent, fontWeight: "700" }}>Pioneer Premium Access</Text> (granted once per user) + earn 50 coins per invite!
          </Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        >
          {/* Premium 10-Referrals Milestone Card */}
          <View style={[styles.milestoneCard, Shadows.m]}>
            <LinearGradient
              colors={isPremiumActive ? ["#003631", "#0A4E46"] : ["#1a2a28", "#0e1f1d"]}
              style={styles.milestoneGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.milestoneHeader}>
                <View style={styles.milestoneIconBox}>
                  <Crown size={22} color={Colors.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.milestoneTitle, { fontFamily: fonts.heading }]}>
                    PREMIUM MILESTONE
                  </Text>
                  <Text style={[styles.milestoneSub, { fontFamily: fonts.body }]}>
                    {isPremiumActive
                      ? "🎉 Pioneer Premium Unlocked! Granted once per user."
                      : `${totalReferred} of ${requiredCount} friends invited`}
                  </Text>
                </View>
                {isPremiumActive && (
                  <View style={styles.unlockedTag}>
                    <Check size={12} color="#003631" />
                    <Text style={styles.unlockedTagText}>UNLOCKED</Text>
                  </View>
                )}
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercent}%`, backgroundColor: isPremiumActive ? "#27AE60" : Colors.accent },
                  ]}
                />
              </View>

              <View style={styles.progressLabelRow}>
                <Text style={[styles.progressLabel, { fontFamily: fonts.body }]}>
                  {isPremiumActive
                    ? "Full Pioneer Access Active"
                    : `${remainingCount} more referral${remainingCount === 1 ? "" : "s"} needed`}
                </Text>
                <Text style={[styles.progressPercent, { fontFamily: fonts.heading }]}>
                  {progressPercent}%
                </Text>
              </View>

              {/* Perks list */}
              <View style={styles.perksGrid}>
                <View style={styles.perkItem}>
                  <Zap size={14} color={Colors.accent} />
                  <Text style={[styles.perkText, { fontFamily: fonts.body }]}>
                    Unlimited Stories
                  </Text>
                </View>
                <View style={styles.perkItem}>
                  <Coins size={14} color="#D4AF37" />
                  <Text style={[styles.perkText, { fontFamily: fonts.body }]}>
                    +500 Bonus Coins
                  </Text>
                </View>
                <View style={styles.perkItem}>
                  <Sparkles size={14} color={Colors.accent} />
                  <Text style={[styles.perkText, { fontFamily: fonts.body }]}>
                    Early Beta Features
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Referral Code Card */}
          <View style={[styles.card, { backgroundColor: theme.white }]}>
            <Text style={[styles.cardLabel, { fontFamily: fonts.heading, color: Colors.mutedTeal }]}>
              YOUR UNIQUE INVITE CODE
            </Text>

            <View style={styles.codeBox}>
              <Text style={[styles.codeText, { fontFamily: fonts.heading }]}>
                {referralInfo?.referralCode || "NEST-VIP"}
              </Text>
              <TouchableOpacity
                style={[styles.copyBtn, copied && { backgroundColor: "#27AE60" }]}
                onPress={handleCopyCode}
                activeOpacity={0.8}
              >
                {copied ? (
                  <CheckCircle2 size={18} color="#FFFFFF" />
                ) : (
                  <Copy size={18} color={Colors.primary} />
                )}
                <Text
                  style={[
                    styles.copyBtnText,
                    { fontFamily: fonts.heading },
                    copied && { color: "#FFFFFF" },
                  ]}
                >
                  {copied ? "COPIED" : "COPY"}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#003631", "#004D46"]}
                style={styles.shareGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Share2 size={20} color={Colors.accent} />
                <Text style={[styles.shareBtnText, { fontFamily: fonts.heading }]}>
                  SHARE INVITE LINK
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* WhatsApp Channel Card */}
          <TouchableOpacity
            style={[styles.whatsappCard, Shadows.m]}
            onPress={openWhatsAppChannel}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#25D366", "#128C7E"]}
              style={styles.whatsappGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.whatsappLeft}>
                <MessageCircle size={28} color="#FFFFFF" />
                <View style={{ marginLeft: 14, flex: 1 }}>
                  <View style={styles.waBadgeRow}>
                    <Text style={[styles.waTitle, { fontFamily: fonts.heading }]}>
                      StoryNest WhatsApp Channel
                    </Text>
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>OFFICIAL</Text>
                    </View>
                  </View>
                  <Text style={[styles.waSub, { fontFamily: fonts.body }]}>
                    Get new story releases, secret codes & author updates
                  </Text>
                </View>
              </View>
              <View style={styles.joinPill}>
                <Text style={[styles.joinPillText, { fontFamily: fonts.heading }]}>
                  JOIN
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Referral Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: theme.white }]}>
              <Users size={22} color={Colors.primary} />
              <Text style={[styles.statNumber, { fontFamily: fonts.heading, color: theme.black }]}>
                {totalReferred}
              </Text>
              <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>
                Friends Joined
              </Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: theme.white }]}>
              <Coins size={22} color="#D4AF37" />
              <Text style={[styles.statNumber, { fontFamily: fonts.heading, color: theme.black }]}>
                {referralInfo?.coinsEarned || 0}
              </Text>
              <Text style={[styles.statLabel, { fontFamily: fonts.body }]}>
                Coins Earned
              </Text>
            </View>
          </View>

          {/* Claim a Friend's Code Section */}
          {!referralInfo?.hasBeenReferred && (
            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <View style={styles.claimHeader}>
                <Sparkles size={18} color={Colors.primary} />
                <Text
                  style={[
                    styles.claimTitle,
                    { fontFamily: fonts.heading, color: theme.black },
                  ]}
                >
                  Have a Friend's Code?
                </Text>
              </View>
              <Text style={[styles.claimSub, { fontFamily: fonts.body }]}>
                Enter an invite code to instantly claim 25 Story Coins & 50 XP.
              </Text>

              <View style={styles.claimInputRow}>
                <TextInput
                  style={[
                    styles.claimInput,
                    {
                      fontFamily: fonts.heading,
                      borderColor: isDarkMode
                        ? "rgba(255,255,255,0.15)"
                        : "rgba(0,54,49,0.2)",
                      color: theme.black,
                    },
                  ]}
                  placeholder="e.g. NEST-ALEX-1234"
                  placeholderTextColor={Colors.mutedTeal}
                  value={inputCode}
                  onChangeText={setInputCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[
                    styles.claimBtn,
                    (!inputCode.trim() || claiming) && { opacity: 0.6 },
                  ]}
                  onPress={handleClaimCode}
                  disabled={!inputCode.trim() || claiming}
                >
                  {claiming ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Text style={[styles.claimBtnText, { fontFamily: fonts.heading }]}>
                      CLAIM
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* How It Works */}
          <View style={[styles.card, { backgroundColor: theme.white }]}>
            <Text style={[styles.cardLabel, { fontFamily: fonts.heading, color: Colors.mutedTeal }]}>
              HOW IT WORKS
            </Text>

            <View style={styles.stepRow}>
              <View style={styles.stepNumberCircle}>
                <Text style={styles.stepNumber}>1</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.stepTitle, { fontFamily: fonts.heading, color: theme.black }]}>
                  Share Your Invite Code
                </Text>
                <Text style={[styles.stepSub, { fontFamily: fonts.body }]}>
                  Send your code or link to friends who love good stories.
                </Text>
              </View>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepNumberCircle}>
                <Text style={styles.stepNumber}>2</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.stepTitle, { fontFamily: fonts.heading, color: theme.black }]}>
                  They Sign Up
                </Text>
                <Text style={[styles.stepSub, { fontFamily: fonts.body }]}>
                  When they join and enter your code, they get 25 Story Coins!
                </Text>
              </View>
            </View>

            <View style={[styles.stepRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.stepNumberCircle, { backgroundColor: "#D4AF37" }]}>
                <Text style={[styles.stepNumber, { color: "#003631" }]}>3</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.stepTitle, { fontFamily: fonts.heading, color: theme.black }]}>
                  Reach 10 Referrals = Free Premium!
                </Text>
                <Text style={[styles.stepSub, { fontFamily: fonts.body }]}>
                  You earn 50 coins per friend + full Pioneer Premium once you hit 10 referrals (granted once per user).
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 28 },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: { padding: 4 },
  navTitle: {
    fontSize: 16,
    color: Colors.accent,
    letterSpacing: 2,
  },
  headerHero: { alignItems: "center", marginTop: 4 },
  giftIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    ...Shadows.m,
  },
  heroTitle: {
    fontSize: 20,
    color: Colors.white,
    textAlign: "center",
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 12,
    color: Colors.paleGreen,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: { padding: 20 },
  milestoneCard: {
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 16,
  },
  milestoneGradient: {
    padding: 20,
  },
  milestoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  milestoneIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,237,168,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneTitle: {
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 1.5,
    fontWeight: "bold",
  },
  milestoneSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  unlockedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  unlockedTagText: {
    fontSize: 9,
    color: "#003631",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  progressLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
  },
  progressPercent: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: "bold",
  },
  perksGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 12,
  },
  perkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  perkText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.9)",
  },
  card: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    ...Shadows.s,
  },
  cardLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,54,49,0.05)",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(0,54,49,0.15)",
    borderStyle: "dashed",
    marginBottom: 16,
  },
  codeText: {
    fontSize: 18,
    color: "#003631",
    letterSpacing: 2,
    fontWeight: "bold",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  copyBtnText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  shareBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  shareGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    gap: 10,
  },
  shareBtnText: {
    color: Colors.accent,
    fontSize: 13,
    letterSpacing: 1.5,
    fontWeight: "bold",
  },
  whatsappCard: {
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 16,
  },
  whatsappGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },
  whatsappLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  waBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  waTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  liveBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  waSub: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    marginTop: 2,
  },
  joinPill: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
  },
  joinPillText: {
    color: "#128C7E",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    ...Shadows.s,
  },
  statNumber: {
    fontSize: 24,
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.mutedTeal,
  },
  claimHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  claimTitle: {
    fontSize: 15,
    fontWeight: "bold",
  },
  claimSub: {
    fontSize: 12,
    color: Colors.mutedTeal,
    marginBottom: 14,
  },
  claimInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  claimInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  claimBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  claimBtnText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  stepNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "bold",
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: "bold",
  },
  stepSub: {
    fontSize: 11,
    color: Colors.mutedTeal,
    marginTop: 2,
  },
});
