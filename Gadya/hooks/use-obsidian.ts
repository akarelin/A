import { useState, useCallback, useEffect } from "react";
import { Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  OBSIDIAN_CONFIG,
  MarkdownFile,
  SearchResult,
  requestStoragePermissions,
  getAllMarkdownFiles,
  searchMarkdownFiles,
  saveDailyNote,
  readMarkdownFile,
  getVaultSummary,
} from "@/services/obsidian-files";

const OBSIDIAN_SETTINGS_KEY = "gadya_obsidian_settings";

export interface ObsidianSettings {
  basePath: string;
  dailyNotesFolder: string;
  hasPermission: boolean;
}

export function useObsidian() {
  const [settings, setSettings] = useState<ObsidianSettings>({
    basePath: OBSIDIAN_CONFIG.basePath,
    dailyNotesFolder: OBSIDIAN_CONFIG.dailyNotesFolder,
    hasPermission: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Load settings on mount
  useEffect(() => {
    AsyncStorage.getItem(OBSIDIAN_SETTINGS_KEY).then((data) => {
      if (data) {
        try {
          const saved = JSON.parse(data);
          setSettings((prev) => ({ ...prev, ...saved }));
        } catch (e) {
          console.error("[useObsidian] Failed to parse settings:", e);
        }
      }
    });
  }, []);

  // Save settings when they change
  const updateSettings = useCallback(async (newSettings: Partial<ObsidianSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await AsyncStorage.setItem(OBSIDIAN_SETTINGS_KEY, JSON.stringify(updated));
  }, [settings]);

  // Request permissions
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Not Available",
        "File system access is only available on Android devices."
      );
      return false;
    }

    setIsLoading(true);
    try {
      const granted = await requestStoragePermissions();
      await updateSettings({ hasPermission: granted });
      
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Storage permission is needed to access your Obsidian vault."
        );
      }
      
      return granted;
    } finally {
      setIsLoading(false);
    }
  }, [updateSettings]);

  // Load all markdown files
  const loadFiles = useCallback(async () => {
    if (Platform.OS === "web") {
      console.log("[useObsidian] File loading not available on web");
      return [];
    }

    setIsLoading(true);
    try {
      const allFiles = await getAllMarkdownFiles(settings.basePath);
      setFiles(allFiles);
      console.log(`[useObsidian] Loaded ${allFiles.length} files`);
      return allFiles;
    } catch (error) {
      console.error("[useObsidian] Error loading files:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [settings.basePath]);

  // Search files
  const search = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (Platform.OS === "web") {
      console.log("[useObsidian] Search not available on web");
      return [];
    }

    if (!query.trim()) {
      setSearchResults([]);
      return [];
    }

    setIsLoading(true);
    try {
      // Update the base path in config before searching
      OBSIDIAN_CONFIG.basePath = settings.basePath;
      const results = await searchMarkdownFiles(query);
      setSearchResults(results);
      return results;
    } catch (error) {
      console.error("[useObsidian] Search error:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [settings.basePath]);

  // Save a note to Daily Notes
  const saveNote = useCallback(async (content: string, title?: string): Promise<boolean> => {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Saving notes is only available on Android devices.");
      return false;
    }

    setIsLoading(true);
    try {
      // Update config with current settings
      OBSIDIAN_CONFIG.basePath = settings.basePath;
      OBSIDIAN_CONFIG.dailyNotesFolder = settings.dailyNotesFolder;
      
      const result = await saveDailyNote(content, title);
      
      if (result.success) {
        console.log("[useObsidian] Note saved to:", result.path);
        return true;
      } else {
        Alert.alert("Error", result.error || "Failed to save note");
        return false;
      }
    } catch (error) {
      console.error("[useObsidian] Save error:", error);
      Alert.alert("Error", "Failed to save note");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [settings]);

  // Read a specific file
  const readFile = useCallback(async (path: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return null;
    }

    try {
      const result = await readMarkdownFile(path);
      return result.success ? result.content || null : null;
    } catch (error) {
      console.error("[useObsidian] Read error:", error);
      return null;
    }
  }, []);

  // Get vault summary
  const getSummary = useCallback(async () => {
    if (Platform.OS === "web") {
      return { totalFiles: 0, folders: [], recentFiles: [] };
    }

    OBSIDIAN_CONFIG.basePath = settings.basePath;
    return getVaultSummary();
  }, [settings.basePath]);

  // Get context for AI from search results
  const getContextForQuery = useCallback(async (query: string): Promise<string> => {
    const results = await search(query);
    
    if (results.length === 0) {
      return "";
    }

    // Build context from top results
    const contextParts: string[] = [];
    for (const result of results.slice(0, 3)) {
      contextParts.push(`From "${result.file.name}":\n${result.matches.join("\n")}`);
    }

    return contextParts.join("\n\n---\n\n");
  }, [search]);

  return {
    settings,
    updateSettings,
    isLoading,
    files,
    searchResults,
    requestPermission,
    loadFiles,
    search,
    saveNote,
    readFile,
    getSummary,
    getContextForQuery,
    isAvailable: Platform.OS !== "web",
  };
}
