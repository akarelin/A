import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { VoiceButton } from "@/components/voice-button";
import { Colors, Spacing, BorderRadius, VoiceColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDictation } from "@/hooks/use-dictation";
import { useAuth } from "@/hooks/use-auth";

type RephraseStyle = "formal" | "casual" | "concise" | "expanded";

export default function DictateScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [showRephraseOptions, setShowRephraseOptions] = useState(false);

  const dictation = useDictation({
    onError: (error) => Alert.alert("Error", error),
  });

  // Handle voice button press
  const handleVoicePress = useCallback(async () => {
    if (dictation.voiceStatus === "listening") {
      await dictation.stopRecording();
    } else if (dictation.voiceStatus === "speaking") {
      dictation.stopSpeaking();
    } else {
      await dictation.startRecording();
    }
  }, [dictation]);

  // Handle read back
  const handleReadBack = useCallback(
    (portion: "all" | "selection" | "last-paragraph") => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      dictation.readBack(portion);
    },
    [dictation]
  );

  // Handle rephrase
  const handleRephrase = useCallback(
    async (style?: RephraseStyle) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowRephraseOptions(false);
      try {
        const rephrased = await dictation.rephrase(style);
        if (rephrased) {
          // Optionally read back the rephrased text
          dictation.readBack("all");
        }
      } catch {
        // Error handled in hook
      }
    },
    [dictation]
  );

  // Handle save
  const handleSave = useCallback(() => {
    if (!dictation.text.trim()) {
      Alert.alert("Nothing to Save", "Please dictate some text first.");
      return;
    }

    if (!isAuthenticated) {
      Alert.alert(
        "Login Required",
        "Please login to save notes.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push("/") },
        ]
      );
      return;
    }

    // Navigate to save modal
    router.push({
      pathname: "/save-note",
      params: { content: dictation.text },
    });
  }, [dictation.text, isAuthenticated, router]);

  // Handle clear
  const handleClear = useCallback(() => {
    if (!dictation.text.trim()) return;

    Alert.alert(
      "Clear Text",
      "Are you sure you want to clear all text?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            dictation.clearText();
          },
        },
      ]
    );
  }, [dictation]);

  // Get status text
  const getStatusText = () => {
    switch (dictation.voiceStatus) {
      case "listening":
        return "Listening...";
      case "processing":
        return "Processing...";
      case "speaking":
        return "Reading...";
      default:
        return "Tap to dictate";
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <ThemedText type="title">Dictation</ThemedText>
        <View style={styles.headerActions}>
          {dictation.text.trim() && (
            <>
              <Pressable style={styles.headerButton} onPress={dictation.undo}>
                <Ionicons name="arrow-undo" size={22} color={colors.tint} />
              </Pressable>
              <Pressable style={styles.headerButton} onPress={handleClear}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Text Area */}
      <ScrollView
        style={styles.textArea}
        contentContainerStyle={styles.textContent}
      >
        {dictation.text ? (
          <TextInput
            style={[styles.textInput, { color: colors.text }]}
            value={dictation.text}
            onChangeText={dictation.setText}
            multiline
            placeholder="Your dictation will appear here..."
            placeholderTextColor={colors.textSecondary}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="mic-outline"
              size={64}
              color={colors.textSecondary}
            />
            <ThemedText
              style={styles.emptyText}
              lightColor={colors.textSecondary}
              darkColor={colors.textSecondary}
            >
              Tap the microphone to start dictating. Your text will appear here
              and you can edit it.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Action Bar */}
      {dictation.text.trim() && (
        <View style={[styles.actionBar, { backgroundColor: colors.card }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.actionBarContent}
          >
            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.inputBackground }]}
              onPress={() => handleReadBack("all")}
            >
              <Ionicons name="play" size={18} color={colors.tint} />
              <ThemedText style={styles.actionText}>Read All</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.inputBackground }]}
              onPress={() => handleReadBack("last-paragraph")}
            >
              <Ionicons name="return-down-back" size={18} color={colors.tint} />
              <ThemedText style={styles.actionText}>Last Paragraph</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.inputBackground }]}
              onPress={() => setShowRephraseOptions(!showRephraseOptions)}
            >
              <Ionicons name="sparkles" size={18} color={colors.tint} />
              <ThemedText style={styles.actionText}>Rephrase</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.success + "20" }]}
              onPress={handleSave}
            >
              <Ionicons name="save" size={18} color={colors.success} />
              <ThemedText style={[styles.actionText, { color: colors.success }]}>
                Save
              </ThemedText>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* Rephrase Options */}
      {showRephraseOptions && (
        <View style={[styles.rephraseOptions, { backgroundColor: colors.card }]}>
          <ThemedText style={styles.rephraseTitle}>Rephrase Style</ThemedText>
          <View style={styles.rephraseButtons}>
            {(["formal", "casual", "concise", "expanded"] as RephraseStyle[]).map(
              (style) => (
                <Pressable
                  key={style}
                  style={[
                    styles.rephraseButton,
                    { backgroundColor: colors.inputBackground },
                  ]}
                  onPress={() => handleRephrase(style)}
                  disabled={dictation.isProcessing}
                >
                  <ThemedText style={styles.rephraseButtonText}>
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </ThemedText>
                </Pressable>
              )
            )}
          </View>
        </View>
      )}

      {/* Bottom Controls */}
      <View
        style={[
          styles.bottomControls,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        {/* Status */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  dictation.voiceStatus === "listening"
                    ? VoiceColors.recording
                    : dictation.voiceStatus === "processing"
                      ? VoiceColors.processing
                      : dictation.voiceStatus === "speaking"
                        ? VoiceColors.speaking
                        : colors.textTertiary,
              },
            ]}
          />
          <ThemedText style={styles.statusText}>{getStatusText()}</ThemedText>
        </View>

        {/* Voice Button */}
        <VoiceButton
          status={dictation.voiceStatus}
          onPress={handleVoicePress}
          size={100}
          disabled={dictation.isProcessing}
        />

        {/* Word Count */}
        {dictation.text.trim() && (
          <ThemedText
            style={styles.wordCount}
            lightColor={colors.textSecondary}
            darkColor={colors.textSecondary}
          >
            {dictation.text.trim().split(/\s+/).length} words
          </ThemedText>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  headerButton: {
    padding: Spacing.sm,
  },
  textArea: {
    flex: 1,
  },
  textContent: {
    padding: Spacing.lg,
    flexGrow: 1,
  },
  textInput: {
    fontSize: 18,
    lineHeight: 28,
    minHeight: 200,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: Spacing.lg,
    lineHeight: 24,
  },
  actionBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  actionBarContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  rephraseOptions: {
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  rephraseTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  rephraseButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  rephraseButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  rephraseButtonText: {
    fontSize: 14,
  },
  bottomControls: {
    alignItems: "center",
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  wordCount: {
    marginTop: Spacing.md,
    fontSize: 12,
  },
});
