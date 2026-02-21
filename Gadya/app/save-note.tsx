import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { trpc } from "@/lib/trpc";

export default function SaveNoteScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const router = useRouter();
  const params = useLocalSearchParams<{ content?: string }>();

  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("/");

  const createMutation = trpc.notes.create.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error) => {
      Alert.alert("Error", error.message || "Failed to save note");
    },
  });

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert("Title Required", "Please enter a title for your note.");
      return;
    }

    if (!params.content?.trim()) {
      Alert.alert("No Content", "There is no content to save.");
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      content: params.content,
      folder: folder.trim() || "/",
    });
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} style={styles.headerButton}>
            <ThemedText style={{ color: colors.tint }}>Cancel</ThemedText>
          </Pressable>
          <ThemedText type="subtitle">Save Note</ThemedText>
          <Pressable
            onPress={handleSave}
            style={styles.headerButton}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <ThemedText style={{ color: colors.tint, fontWeight: "600" }}>
                Save
              </ThemedText>
            )}
          </Pressable>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.field}>
            <ThemedText style={styles.label}>Title</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                },
              ]}
              placeholder="Enter note title..."
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>Folder (optional)</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                },
              ]}
              placeholder="/"
              placeholderTextColor={colors.textSecondary}
              value={folder}
              onChangeText={setFolder}
            />
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>Preview</ThemedText>
            <View
              style={[
                styles.preview,
                { backgroundColor: colors.inputBackground },
              ]}
            >
              <ThemedText
                style={styles.previewText}
                numberOfLines={10}
                lightColor={colors.textSecondary}
                darkColor={colors.textSecondary}
              >
                {params.content || "No content"}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerButton: {
    minWidth: 60,
  },
  form: {
    gap: Spacing.lg,
  },
  field: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
  },
  preview: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 150,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
