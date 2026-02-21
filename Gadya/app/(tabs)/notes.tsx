import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNotes, Note } from "@/hooks/use-notes";
import { useAuth } from "@/hooks/use-auth";

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const notes = useNotes({
    onError: (error) => Alert.alert("Error", error),
  });

  // Handle search
  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);
      if (text.trim()) {
        notes.searchNotes(text);
      } else {
        notes.clearSearch();
      }
    },
    [notes]
  );

  // Handle note press
  const handleNotePress = useCallback(
    (note: Note) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/note-detail",
        params: { id: note.id.toString() },
      });
    },
    [router]
  );

  // Handle delete
  const handleDelete = useCallback(
    (note: Note) => {
      Alert.alert(
        "Delete Note",
        `Are you sure you want to delete "${note.title}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await notes.deleteNote(note.id);
            },
          },
        ]
      );
    },
    [notes]
  );

  // Handle create new note
  const handleCreateNote = useCallback(() => {
    router.push({
      pathname: "/save-note",
      params: { content: "" },
    });
  }, [router]);

  // Render note item
  const renderNote = useCallback(
    ({ item }: { item: Note }) => (
      <Pressable
        style={[styles.noteCard, { backgroundColor: colors.card }]}
        onPress={() => handleNotePress(item)}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.noteHeader}>
          <Ionicons name="document-text" size={20} color={colors.tint} />
          <ThemedText style={styles.noteTitle} numberOfLines={1}>
            {item.title}
          </ThemedText>
        </View>
        <ThemedText
          style={styles.notePreview}
          numberOfLines={2}
          lightColor={colors.textSecondary}
          darkColor={colors.textSecondary}
        >
          {item.content}
        </ThemedText>
        <View style={styles.noteMeta}>
          <ThemedText
            style={styles.noteFolder}
            lightColor={colors.textTertiary}
            darkColor={colors.textTertiary}
          >
            {item.folder}
          </ThemedText>
          <ThemedText
            style={styles.noteDate}
            lightColor={colors.textTertiary}
            darkColor={colors.textTertiary}
          >
            {new Date(item.updatedAt).toLocaleDateString()}
          </ThemedText>
        </View>
      </Pressable>
    ),
    [colors, handleNotePress, handleDelete]
  );

  // Show login prompt if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">Notes</ThemedText>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed-outline" size={64} color={colors.textSecondary} />
          <ThemedText
            style={styles.emptyText}
            lightColor={colors.textSecondary}
            darkColor={colors.textSecondary}
          >
            Please login to access your notes.
          </ThemedText>
          <Pressable
            style={[styles.loginButton, { backgroundColor: colors.tint }]}
            onPress={() => router.push("/")}
          >
            <ThemedText style={styles.loginButtonText}>Go to Login</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const displayNotes = searchText.trim() ? notes.searchResults : notes.notes;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <ThemedText type="title">Notes</ThemedText>
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.tint }]}
          onPress={handleCreateNote}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.inputBackground,
              borderColor: isSearching ? colors.tint : "transparent",
            },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search notes..."
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={handleSearch}
            onFocus={() => setIsSearching(true)}
            onBlur={() => setIsSearching(false)}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Notes List */}
      {notes.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : displayNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={searchText ? "search-outline" : "document-outline"}
            size={64}
            color={colors.textSecondary}
          />
          <ThemedText
            style={styles.emptyText}
            lightColor={colors.textSecondary}
            darkColor={colors.textSecondary}
          >
            {searchText
              ? "No notes found matching your search."
              : "No notes yet. Create your first note!"}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={displayNotes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderNote}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={notes.isLoading}
              onRefresh={notes.refetch}
              tintColor={colors.tint}
            />
          }
        />
      )}
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  loginButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  noteCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  noteTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
  },
  notePreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  noteMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  noteFolder: {
    fontSize: 12,
  },
  noteDate: {
    fontSize: 12,
  },
});
