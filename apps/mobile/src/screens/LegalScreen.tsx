import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Shield, FileText } from "lucide-react-native";
import { HeaderWave } from "../components/HeaderWave";

export const LegalScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { type } = route.params; // 'tos' | 'privacy'

  const content = type === 'tos' ? {
    title: "Terms of Service",
    icon: <FileText size={32} color={Colors.primary} />,
    body: `Welcome to StoryNest. By using our application, you agree to the following terms:

1. ACCEPTANCE OF TERMS
By accessing the "Nest", you agree to be bound by these terms. If you do not agree, please do not use the app.

2. ELIGIBILITY
You must be at least 13 years of age to use StoryNest. We do not knowingly collect data from anyone under 13.

3. USER CONTENT
You retain ownership of any stories or comments you post. However, by posting, you grant StoryNest a non-exclusive license to display your content to other users.

4. PROHIBITED CONDUCT
Users may not post harmful, illegal, or offensive material. We reserve the right to remove any content that violates our community standards.

5. ACCOUNT SECURITY
You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.`
  } : {
    title: "Privacy Policy",
    icon: <Shield size={32} color={Colors.primary} />,
    body: `Your privacy is our priority in the Nest. This policy explains how we handle your data:

1. DATA COLLECTION
We collect your email, username, and reading progress to provide a personalized experience. We also collect crash reports and analytics to improve the app.

2. DATA USAGE
Your data is used solely to manage your account, sync your library, and notify you of new stories (if enabled).

3. THIRD-PARTY SERVICES
We use Firebase for authentication and database management. Your credentials are encrypted and secure.

4. COOKIES & TRACKING
The app uses local storage to keep you logged in. We do not sell your personal data to third parties.

5. YOUR RIGHTS
You can request to delete your account and all associated data at any time through the settings menu.`
  };

  return (
    <View style={styles.container}>
        <View style={[styles.headerSection, { paddingTop: insets.top + 20 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <ArrowLeft size={24} color={Colors.accent} />
            </TouchableOpacity>
            <View style={styles.iconCircle}>
                {content.icon}
            </View>
            <Text style={styles.title}>{content.title}</Text>
            <HeaderWave color={Colors.paleCream} />
        </View>

        <SafeAreaView style={styles.bottomSection} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.legalText}>{content.body}</Text>
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Last Updated: May 2026</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paleCream },
  headerSection: { backgroundColor: Colors.primary, paddingBottom: 80, alignItems: 'center' },
  backBtn: { position: 'absolute', left: 24, top: 60 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontFamily: Fonts.heading, fontSize: 24, color: Colors.white, letterSpacing: 1 },
  bottomSection: { flex: 1 },
  scrollContent: { padding: 32 },
  legalText: { fontFamily: Fonts.body, fontSize: 15, color: Colors.primary, lineHeight: 26, textAlign: 'justify' },
  footer: { marginTop: 40, borderTopWidth: 1, borderTopColor: 'rgba(0,54,49,0.1)', paddingTop: 20 },
  footerText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.mutedTeal, textAlign: 'center', fontStyle: 'italic' }
});