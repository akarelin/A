import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";

export interface Note {
  id: number;
  userId: number;
  title: string;
  content: string;
  folder: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UseNotesOptions {
  onError?: (error: string) => void;
}

export function useNotes(options: UseNotesOptions = {}) {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Queries
  const notesQuery = trpc.notes.list.useQuery({}, {
    retry: false,
  });

  const searchResults = trpc.notes.search.useQuery(
    { query: searchQuery },
    {
      enabled: searchQuery.length > 0,
      retry: false,
    }
  );

  // Mutations
  const createMutation = trpc.notes.create.useMutation({
    onSuccess: () => {
      notesQuery.refetch();
    },
    onError: (error) => {
      options.onError?.(error.message || "Failed to create note");
    },
  });

  const updateMutation = trpc.notes.update.useMutation({
    onSuccess: () => {
      notesQuery.refetch();
    },
    onError: (error) => {
      options.onError?.(error.message || "Failed to update note");
    },
  });

  const deleteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      notesQuery.refetch();
      if (selectedNote) {
        setSelectedNote(null);
      }
    },
    onError: (error) => {
      options.onError?.(error.message || "Failed to delete note");
    },
  });

  // Summarize mutation
  const summarizeMutation = trpc.ai.summarize.useMutation();

  // Actions
  const createNote = useCallback(
    async (title: string, content: string, folder?: string) => {
      return createMutation.mutateAsync({ title, content, folder });
    },
    [createMutation]
  );

  const updateNote = useCallback(
    async (id: number, data: { title?: string; content?: string; folder?: string }) => {
      return updateMutation.mutateAsync({ id, ...data });
    },
    [updateMutation]
  );

  const deleteNote = useCallback(
    async (id: number) => {
      return deleteMutation.mutateAsync({ id });
    },
    [deleteMutation]
  );

  const searchNotes = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const summarizeNote = useCallback(
    async (content: string, maxLength?: "brief" | "medium" | "detailed") => {
      return summarizeMutation.mutateAsync({ content, maxLength });
    },
    [summarizeMutation]
  );

  // Get notes organized by folder
  const getNotesByFolder = useCallback(() => {
    const notes = notesQuery.data || [];
    const folders: Record<string, Note[]> = {};

    for (const note of notes) {
      const folder = note.folder || "/";
      if (!folders[folder]) {
        folders[folder] = [];
      }
      folders[folder].push(note as Note);
    }

    return folders;
  }, [notesQuery.data]);

  // Get recent notes
  const getRecentNotes = useCallback(
    (limit: number = 5) => {
      const notes = notesQuery.data || [];
      return notes.slice(0, limit) as Note[];
    },
    [notesQuery.data]
  );

  // Find notes by title (local search)
  const findNoteByTitle = useCallback(
    (title: string) => {
      const notes = notesQuery.data || [];
      const lowerTitle = title.toLowerCase();
      return notes.find((note) => note.title.toLowerCase().includes(lowerTitle)) as Note | undefined;
    },
    [notesQuery.data]
  );

  return {
    // Data
    notes: (notesQuery.data || []) as Note[],
    searchResults: (searchResults.data || []) as Note[],
    selectedNote,
    searchQuery,

    // Loading states
    isLoading: notesQuery.isLoading,
    isSearching: searchResults.isLoading,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSummarizing: summarizeMutation.isPending,

    // Actions
    createNote,
    updateNote,
    deleteNote,
    searchNotes,
    clearSearch,
    summarizeNote,
    setSelectedNote,
    refetch: notesQuery.refetch,

    // Helpers
    getNotesByFolder,
    getRecentNotes,
    findNoteByTitle,
  };
}
