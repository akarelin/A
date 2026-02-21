import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface ResponseCardProps {
  query: string;
  response: string;
  isSpeaking?: boolean;
  onPlayPause?: () => void;
  onCopy?: () => void;
  timestamp?: Date;
}

export function ResponseCard({
  query,
  response,
  isSpeaking = false,
  onPlayPause,
  onCopy,
  timestamp,
}: ResponseCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const handlePlayPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlayPause?.();
  };

  const handleCopy = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCopy?.();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Query section */}
      <View style={styles.querySection}>
        <View style={[styles.queryBubble, { backgroundColor: colors.tint }]}>
          <ThemedText style={styles.queryText} lightColor="#FFFFFF" darkColor="#FFFFFF">
            {query}
          </ThemedText>
        </View>
        {timestamp && (
          <ThemedText
            style={styles.timestamp}
            lightColor={colors.textSecondary}
            darkColor={colors.textSecondary}
          >
            {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </ThemedText>
        )}
      </View>

      {/* Response section */}
      <View style={styles.responseSection}>
        <ThemedText style={styles.responseText}>{response}</ThemedText>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {onPlayPause && (
          <Pressable
            onPress={handlePlayPause}
            style={[styles.actionButton, { backgroundColor: colors.inputBackground }]}
          >
            <Ionicons
              name={isSpeaking ? "pause" : "play"}
              size={20}
              color={colors.tint}
            />
            <ThemedText style={styles.actionText}>
              {isSpeaking ? "Pause" : "Play"}
            </ThemedText>
          </Pressable>
        )}

        {onCopy && (
          <Pressable
            onPress={handleCopy}
            style={[styles.actionButton, { backgroundColor: colors.inputBackground }]}
          >
            <Ionicons name="copy-outline" size={20} color={colors.tint} />
            <ThemedText style={styles.actionText}>Copy</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  querySection: {
    marginBottom: Spacing.md,
  },
  queryBubble: {
    alignSelf: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    maxWidth: "85%",
  },
  queryText: {
    fontSize: 15,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 11,
    marginTop: Spacing.xs,
    textAlign: "right",
  },
  responseSection: {
    paddingVertical: Spacing.sm,
  },
  responseText: {
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
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
});
