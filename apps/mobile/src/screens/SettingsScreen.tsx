import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Platform, Switch, Alert } from "react-native";
import { Colors, Spacing, Radii, Shadows } from "../theme/colors";
import { Fonts } from "../theme/fonts";
import { ArrowLeft, Bell, Moon, Shield, Info, LogOut, ChevronRight, Globe, Lock, Sparkles } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export const SettingsScreen = ({ navigation }: any) => {
  const { logout, user } = useAuth();
  const { isDarkMode, toggleDarkMode, recsEnabled, setRecsEnabled, theme } = useTheme();
  
  const [notifications, setNotifications] = React.useState(true);

  const SettingItem = ({ icon, title, value, onPress, isSwitch, switchValue, onValueChange }: any) => (
    <TouchableOpacity 
      style={[styles.item, { borderBottomColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]} 
      onPress={onPress} 
      activeOpacity={isSwitch ? 1 : 0.7}
      disabled={isSwitch && !onPress}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : Colors.paleGreen }]}>{icon}</View>
        <Text style={[styles.itemTitle, { color: isDarkMode ? Colors.accent : Colors.primary }]}>{title}</Text>
      </View>
      <View style={styles.itemRight}>
        {isSwitch ? (
          <Switch 
            value={switchValue} 
            onValueChange={onValueChange}
            trackColor={{ false: "#767577", true: Colors.primary }}
            thumbColor={switchValue ? Colors.accent : "#f4f3f4"}
          />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {value && <Text style={styles.itemValue}>{value}</Text>}
            <ChevronRight size={18} color={Colors.mutedTeal} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.white }]}>
      <SafeAreaView style={[styles.header, { backgroundColor: Colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTINGS</Text>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <SettingItem 
          icon={<Bell size={20} color={isDarkMode ? Colors.accent : Colors.primary} />} 
          title="Push Notifications" 
          isSwitch
          switchValue={notifications}
          onValueChange={setNotifications}
        />
        <SettingItem 
          icon={<Moon size={20} color={isDarkMode ? Colors.accent : Colors.primary} />} 
          title="App-wide Dark Mode" 
          isSwitch
          switchValue={isDarkMode}
          onValueChange={toggleDarkMode}
        />
        <SettingItem 
          icon={<Sparkles size={20} color={isDarkMode ? Colors.accent : Colors.primary} />} 
          title="Recommended Stories" 
          isSwitch
          switchValue={recsEnabled}
          onValueChange={setRecsEnabled}
        />
        <SettingItem 
          icon={<Globe size={20} color={isDarkMode ? Colors.accent : Colors.primary} />} 
          title="Language" 
          value="English"
          onPress={() => Alert.alert("Language", "Multi-language support coming in next update!")}
        />

        <Text style={styles.sectionTitle}>ACCOUNT & SECURITY</Text>
        <SettingItem 
          icon={<Lock size={20} color={isDarkMode ? Colors.accent : Colors.primary} />} 
          title="Change Password" 
          onPress={() => Alert.alert("Security", "Password reset link sent to your email.")}
        />
        <SettingItem 
          icon={<Shield size={20} color={isDarkMode ? Colors.accent : Colors.primary} />} 
          title="Privacy Policy" 
          onPress={() => Alert.alert("Privacy", "Your reading habits are private and never shared.")}
        />
        <SettingItem 
          icon={<Info size={20} color={isDarkMode ? Colors.accent : Colors.primary} />} 
          title="About StoryNest" 
          value="v1.1.0"
          onPress={() => Alert.alert("About", "StoryNest - The home for your imagination.")}
        />

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LogOut size={20} color="#FF6B6B" />
          <Text style={styles.logoutText}>LOG OUT</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>Logged in as: {user?.email}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingTop: Platform.OS === 'android' ? 10 : 0 },
  backBtn: { position: "absolute", left: 20, top: Platform.OS === 'android' ? 20 : 10 },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.accent, letterSpacing: 0.05, marginTop: 10 },
  content: { flex: 1, padding: 24 },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.mutedTeal, marginBottom: 16, marginTop: 24, letterSpacing: 0.02 },
  item: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1 },
  itemLeft: { flexDirection: "row", alignItems: "center" },
  iconContainer: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 16 },
  itemTitle: { fontFamily: Fonts.body, fontSize: 16 },
  itemValue: { fontFamily: Fonts.body, fontSize: 14, color: Colors.mutedTeal, marginRight: 8 },
  itemRight: {},
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 40, paddingVertical: 16, borderWidth: 1, borderColor: "#FF6B6B", borderRadius: 12 },
  logoutText: { fontFamily: Fonts.heading, color: "#FF6B6B", marginLeft: 12, fontSize: 14 },
  footerText: { textAlign: 'center', marginTop: 32, marginBottom: 40, fontFamily: Fonts.body, fontSize: 12, color: Colors.mutedTeal }
});
