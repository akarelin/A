import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/use-auth";
import { useObsidian } from "@/hooks/use-obsidian";

const SETTINGS_KEY = "gadya_settings";

interface SettingItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

function SettingItem({ icon, title, subtitle, onPress, rightElement }: SettingItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <Pressable
      style={[styles.settingItem, { backgroundColor: colors.card }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.tint + "20" }]}>
        <Ionicons name={icon as any} size={20} color={colors.tint} />
      </View>
      <View style={styles.settingContent}>
        <ThemedText style={styles.settingTitle}>{title}</ThemedText>
        {subtitle && (
          <ThemedText
            style={styles.settingSubtitle}
            lightColor={colors.textSecondary}
            darkColor={colors.textSecondary}
          >
            {subtitle}
          </ThemedText>
        )}
      </View>
      {rightElement || (
        onPress && <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { user, isAuthenticated, logout } = useAuth();
  const obsidian = useObsidian();

  // Voice settings state
  const [speechRate, setSpeechRate] = useState(0.9);
  const [autoListen, setAutoListen] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  // Obsidian settings editing
  const [editingPath, setEditingPath] = useState(false);
  const [tempBasePath, setTempBasePath] = useState(obsidian.settings.basePath);
  const [tempDailyFolder, setTempDailyFolder] = useState(obsidian.settings.dailyNotesFolder);

  // Load settings on mount
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((data) => {
      if (data) {
        const settings = JSON.parse(data);
        setSpeechRate(settings.speechRate ?? 0.9);
        setAutoListen(settings.autoListen ?? true);
        setHapticFeedback(settings.hapticFeedback ?? true);
      }
    });
  }, []);

  // Save settings when they change
  useEffect(() => {
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({
      speechRate,
      autoListen,
      hapticFeedback,
    }));
  }, [speechRate, autoListen, hapticFeedback]);

  // Update temp values when obsidian settings change
  useEffect(() => {
    setTempBasePath(obsidian.settings.basePath);
    setTempDailyFolder(obsidian.settings.dailyNotesFolder);
  }, [obsidian.settings]);

  // Handle logout
  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            logout();
          },
        },
      ]
    );
  };

  // Handle speech rate change
  const handleSpeechRateChange = (value: number) => {
    setSpeechRate(value);
    if (hapticFeedback) {
      Haptics.selectionAsync();
    }
  };

  // Handle Obsidian path save
  const handleSaveObsidianPaths = async () => {
    await obsidian.updateSettings({
      basePath: tempBasePath,
      dailyNotesFolder: tempDailyFolder,
    });
    setEditingPath(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved", "Obsidian paths updated successfully.");
  };

  // Request storage permission
  const handleRequestPermission = async () => {
    const granted = await obsidian.requestPermission();
    if (granted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Test Obsidian connection
  const handleTestConnection = async () => {
    if (!obsidian.isAvailable) {
      Alert.alert("Not Available", "File system access is only available on Android devices.");
      return;
    }

    const summary = await obsidian.getSummary();
    Alert.alert(
      "Obsidian Vault",
      `Found ${summary.totalFiles} markdown files in ${summary.folders.length} folders.\n\nRecent files:\n${summary.recentFiles.slice(0, 5).map(f => `• ${f.name}`).join("\n")}`
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20) + 80,
          },
        ]}
      >
        {/* Header */}
        <ThemedText type="title" style={styles.header}>
          Settings
        </ThemedText>

        {/* Account Section */}
        <View style={styles.section}>
          <ThemedText
            style={styles.sectionTitle}
            lightColor={colors.textSecondary}
            darkColor={colors.textSecondary}
          >
            ACCOUNT
          </ThemedText>
          {isAuthenticated && user ? (
            <>
              <SettingItem
                icon="person-circle"
                title={user.name || "User"}
                subtitle={user.email || user.openId}
              />
              <SettingItem
                icon="log-out-outline"
                title="Logout"
                onPress={handleLogout}
                rightElement={
                  <Ionicons name="log-out-outline" size={20} color={colors.error} />
                }
              />
            </>
          ) : (
            <SettingItem
              icon="log-in-outline"
              title="Login"
              subtitle="Sign in to sync your notes"
              onPress={() => {}}
            />
          )}
        </View>

        {/* Obsidian/Notes Section */}
        <View style={styles.section}>
          <ThemedText
            style={styles.sectionTitle}
            lightColor={colors.textSecondary}
            darkColor={colors.textSecondary}
          >
            OBSIDIAN / NOTES
          </ThemedText>

          <SettingItem
            icon="folder-outline"
            title="Notes Location"
            subtitle={obsidian.settings.basePath}
            onPress={() => setEditingPath(!editingPath)}
            rightElement={
              <Ionicons 
                name={editingPath ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={colors.textTertiary} 
              />
            }
          />

          {editingPath && (
            <View style={[styles.pathEditContainer, { backgroundColor: colors.card }]}>
              <ThemedText style={styles.pathLabel}>Base Path:</ThemedText>
              <TextInput
                style={[styles.pathInput, { 
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                }]}
                value={tempBasePath}
                onChangeText={setTempBasePath}
                placeholder="/storage/emulated/0/_/_/"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              <ThemedText style={styles.pathLabel}>Daily Notes Folder:</ThemedText>
              <TextInput
                style={[styles.pathInput, { 
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                }]}
                value={tempDailyFolder}
                onChangeText={setTempDailyFolder}
                placeholder="Daily Notes"
                placeholderTextColor={colors.textTertiary}
              />

              <Pressable
                style={[styles.saveButton, { backgroundColor: colors.tint }]}
                onPress={handleSaveObsidianPaths}
              >
                <ThemedText style={styles.saveButtonText}>Save Paths</ThemedText>
              </Pressable>
            </View>
          )}

          {Platform.OS !== "web" && (
            <>
              <SettingItem
                icon="key-outline"
                title="Storage Permission"
                subtitle={obsidian.settings.hasPermission ? "Granted" : "Not granted"}
                onPress={handleRequestPermission}
                rightElement={
                  <View style={[
                    styles.permissionBadge, 
                    { backgroundColor: obsidian.settings.hasPermission ? colors.success + "20" : colors.error + "20" }
                  ]}>
                    <ThemedText style={[
                      styles.permissionText,
                      { color: obsidian.settings.hasPermission ? colors.success : colors.error }
                    ]}>
                      {obsidian.settings.hasPermission ? "✓" : "Request"}
                    </ThemedText>
                  </View>
                }
              />

              <SettingItem
                icon="sync-outline"
                title="Test Connection"
                subtitle="Check if Obsidian vault is accessible"
                onPress={handleTestConnection}
              />
            </>
          )}

          {Platform.OS === "web" && (
            <View style={[styles.webNotice, { backgroundColor: colors.warning + "20" }]}>
              <Ionicons name="information-circle" size={20} color={colors.warning} />
              <ThemedText style={[styles.webNoticeText, { color: colors.warning }]}>
                File system access requires Android device
              </ThemedText>
            </View>
          )}
        </View>

        {/* Voice Settings Section */}
        <View style={styles.section}>
          <ThemedText
            style={styles.sectionTitle}
            lightColor={colors.textSecondary}
            darkColor={colors.textSecondary}
          >
            VOICE
          </ThemedText>

          <View style={[styles.settingItem, { backgroundColor: colors.card }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.tint + "20" }]}>
              <Ionicons name="speedometer-outline" size={20} color={colors.tint} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText style={styles.settingTitle}>Speech Rate</ThemedText>
              <ThemedText
                style={styles.settingSubtitle}
                lightColor={colors.textSecondary}
                darkColor={colors.textSecondary}
              >
                {speechRate < 0.7 ? "Slow" : speechRate > 1.1 ? "Fast" : "Normal"}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.sliderContainer, { backgroundColor: colors.card }]}>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={1.5}
              value={speechRate}
              onValueChange={handleSpeechRateChange}
              minimumTrackTintColor={colors.tint}
              maximumTrackTintColor={colors.inputBackground}
              thumbTintColor={colors.tint}
            />
          </View>

          <SettingItem
            icon="mic-outline"
            title="Auto-Listen After Response"
            subtitle="Automatically start listening after AI responds"
            rightElement={
              <Switch
                value={autoListen}
                onValueChange={setAutoListen}
                trackColor={{ false: colors.inputBackground, true: colors.tint + "80" }}
                thumbColor={autoListen ? colors.tint : colors.textTertiary}
              />
            }
          />
        </View>

        {/* General Settings Section */}
        <View style={styles.section}>
          <ThemedText
            style={styles.sectionTitle}
            lightColor={colors.textSecondary}
            darkColor={colors.textSecondary}
          >
            GENERAL
          </ThemedText>

          <SettingItem
            icon="hand-left-outline"
            title="Haptic Feedback"
            subtitle="Vibration feedback for actions"
            rightElement={
              <Switch
                value={hapticFeedback}
                onValueChange={setHapticFeedback}
                trackColor={{ false: colors.inputBackground, true: colors.tint + "80" }}
                thumbColor={hapticFeedback ? colors.tint : colors.textTertiary}
              />
            }
          />

          <SettingItem
            icon="color-palette-outline"
            title="Appearance"
            subtitle="System default"
            onPress={() => Alert.alert("Coming Soon", "Theme customization will be available in a future update.")}
          />
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <ThemedText
            style={styles.sectionTitle}
            lightColor={colors.textSecondary}
            darkColor={colors.textSecondary}
          >
            ABOUT
          </ThemedText>

          <SettingItem
            icon="information-circle-outline"
            title="About Гадя"
            subtitle="Version 1.0.0"
            onPress={() => Alert.alert("Гадя", "A voice-first AI assistant for iOS/Android.\n\nVersion 1.0.0\n\nFeatures:\n• Voice-operated LLM queries\n• Dictation with AI rephrasing\n• Obsidian/markdown integration\n• Hands-free continuous mode")}
          />

          <SettingItem
            icon="help-circle-outline"
            title="Help & Support"
            onPress={() => Alert.alert("Help", "For support, please contact us at support@example.com")}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  sliderContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  pathEditContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  pathLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  pathInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    fontSize: 14,
    fontFamily: "monospace",
  },
  saveButton: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  permissionBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  permissionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  webNotice: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  webNoticeText: {
    fontSize: 13,
    flex: 1,
  },
});
