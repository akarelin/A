import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
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
import { useVoice } from "@/hooks/use-voice";
import { trpc } from "@/lib/trpc";

export default function NoteDetailScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");

  const voice = useVoice({
    onError: (error) => Alert.alert("Voice Error", error),
  });

  // Fetch note
  const noteQuery = trpc.notes.get.useQuery(
    { id: parseInt(params.id || "0", 10) },
    { enabled: !!params.id }
  );

  // Update mutation
  const updateMutation = trpc.notes.update.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
      noteQuery.refetch();
    },
    onError: (error) => {
      Alert.alert("Error", error.message || "Failed to update note");
    },
  });

  // Delete mutation
  const deleteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error) => {
      Alert.alert("Error", error.message || "Failed to delete note");
    },
  });

  // Summarize mutation
  const summarizeMutation = trpc.ai.summarize.useMutation();

  // Initialize edit fields when note loads
  useEffect(() => {
    if (noteQuery.data) {
      setEditedTitle(noteQuery.data.title);
      setEditedContent(noteQuery.data.content);
    }
  }, [noteQuery.data]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!editedTitle.trim()) {
      Alert.alert("Title Required", "Please enter a title.");
      return;
    }

    updateMutation.mutate({
      id: parseInt(params.id || "0", 10),
      title: editedTitle.trim(),
      content: editedContent,
    });
  }, [editedTitle, editedContent, params.id, updateMutation]);

  // Handle delete
  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Note",
      "Are you sure you want to delete this note?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate({ id: parseInt(params.id || "0", 10) });
          },
        },
      ]
    );
  }, [params.id, deleteMutation]);

  // Handle read aloud
  const handleReadAloud = useCallback(() => {
    if (!noteQuery.data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (voice.isSpeaking) {
      voice.stopSpeaking();
    } else {
      const textToRead = `${noteQuery.data.title}. ${noteQuery.data.content}`;
      voice.speak(textToRead);
    }
  }, [noteQuery.data, voice]);

  // Handle summarize
  const handleSummarize = useCallback(async () => {
    if (!noteQuery.data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await summarizeMutation.mutateAsync({
        content: noteQuery.data.content,
        maxLength: "medium",
      });

      Alert.alert("Summary", result.summary, [
        { text: "OK" },
        {
          text: "Read Aloud",
          onPress: () => voice.speak(result.summary),
        },
      ]);
    } catch {
      Alert.alert("Error", "Failed to generate summary");
    }
  }, [noteQuery.data, summarizeMutation, voice]);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    if (noteQuery.data) {
      setEditedTitle(noteQuery.data.title);
      setEditedContent(noteQuery.data.content);
    }
    setIsEditing(false);
  }, [noteQuery.data]);

  if (noteQuery.isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </ThemedView>
    );
  }

  if (!noteQuery.data) {
    return (
      <ThemedView style={styles.container}>
        <View
          style={[
            styles.header,
            { paddingTop: Math.max(insets.top, 20) },
          ]}
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.tint} />
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} />
          <ThemedText
            style={styles.emptyText}
            lightColor={colors.textSecondary}
            darkColor={colors.textSecondary}
          >
            Note not found
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 20) },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.tint} />
        </Pressable>

        <View style={styles.headerActions}>
          {isEditing ? (
            <>
              <Pressable onPress={handleCancelEdit} style={styles.headerButton}>
                <ThemedText style={{ color: colors.textSecondary }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={styles.headerButton}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.tint} />
                ) : (
                  <ThemedText style={{ color: colors.tint, fontWeight: "600" }}>
                    Save
                  </ThemedText>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => setIsEditing(true)}
                style={styles.headerButton}
              >
                <Ionicons name="pencil" size={22} color={colors.tint} />
              </Pressable>
              <Pressable onPress={handleDelete} style={styles.headerButton}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom, 20) + 80 },
        ]}
      >
        {isEditing ? (
          <>
            <TextInput
              style={[
                styles.titleInput,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBackground,
                },
              ]}
              value={editedTitle}
              onChangeText={setEditedTitle}
              placeholder="Note title"
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              style={[
                styles.contentInput,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBackground,
                },
              ]}
              value={editedContent}
              onChangeText={setEditedContent}
              placeholder="Note content..."
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
            />
          </>
        ) : (
          <>
            <ThemedText type="title" style={styles.title}>
              {noteQuery.data.title}
            </ThemedText>
            <View style={styles.meta}>
              <ThemedText
                style={styles.metaText}
                lightColor={colors.textSecondary}
                darkColor={colors.textSecondary}
              >
                {noteQuery.data.folder} • Updated{" "}
                {new Date(noteQuery.data.updatedAt).toLocaleDateString()}
              </ThemedText>
            </View>
            <ThemedText style={styles.noteContent}>
              {noteQuery.data.content}
            </ThemedText>
          </>
        )}
      </ScrollView>

      {/* Voice Actions */}
      {!isEditing && (
        <View
          style={[
            styles.voiceActions,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <Pressable
            style={[styles.voiceButton, { backgroundColor: colors.inputBackground }]}
            onPress={handleReadAloud}
          >
            <Ionicons
              name={voice.isSpeaking ? "stop" : "volume-high"}
              size={20}
              color={colors.tint}
            />
            <ThemedText style={styles.voiceButtonText}>
              {voice.isSpeaking ? "Stop" : "Read Aloud"}
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.voiceButton, { backgroundColor: colors.inputBackground }]}
            onPress={handleSummarize}
            disabled={summarizeMutation.isPending}
          >
            {summarizeMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color={colors.tint} />
                <ThemedText style={styles.voiceButtonText}>Summarize</ThemedText>
              </>
            )}
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  headerButton: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  meta: {
    marginBottom: Spacing.lg,
  },
  metaText: {
    fontSize: 14,
  },
  noteContent: {
    fontSize: 17,
    lineHeight: 26,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: "700",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  contentInput: {
    fontSize: 17,
    lineHeight: 26,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 300,
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
  },
  voiceActions: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  voiceButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  voiceButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
