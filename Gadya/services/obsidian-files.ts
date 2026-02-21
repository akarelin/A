import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import * as MediaLibrary from "expo-media-library";

// Configuration for Obsidian vault location
export const OBSIDIAN_CONFIG = {
  // Base path for all .md files (Android external storage)
  basePath: "/storage/emulated/0/_/_/",
  // Subfolder for saving new daily notes
  dailyNotesFolder: "Daily Notes",
  // File extension
  extension: ".md",
};

export interface MarkdownFile {
  name: string;
  path: string;
  content: string;
  modifiedTime?: number;
}

export interface SearchResult {
  file: MarkdownFile;
  matches: string[];
  score: number;
}

// Request storage permissions (Android)
export async function requestStoragePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") {
    console.log("[Obsidian] Storage permissions only needed on Android");
    return true;
  }

  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      console.log("[Obsidian] Storage permission denied");
      return false;
    }
    console.log("[Obsidian] Storage permission granted");
    return true;
  } catch (error) {
    console.error("[Obsidian] Error requesting permissions:", error);
    return false;
  }
}

// Check if a path is a dot folder (hidden folder)
function isDotFolder(path: string): boolean {
  const parts = path.split("/");
  return parts.some((part) => part.startsWith("."));
}

// Get all markdown files recursively from a directory
export async function getAllMarkdownFiles(
  directory: string = OBSIDIAN_CONFIG.basePath,
  files: MarkdownFile[] = []
): Promise<MarkdownFile[]> {
  try {
    // Check if directory exists
    const dirInfo = await FileSystem.getInfoAsync(directory);
    if (!dirInfo.exists || !dirInfo.isDirectory) {
      console.log("[Obsidian] Directory not found:", directory);
      return files;
    }

    // Read directory contents
    const contents = await FileSystem.readDirectoryAsync(directory);

    for (const item of contents) {
      // Skip dot folders
      if (item.startsWith(".")) {
        continue;
      }

      const itemPath = `${directory}/${item}`;
      const itemInfo = await FileSystem.getInfoAsync(itemPath);

      if (itemInfo.isDirectory) {
        // Recursively search subdirectories
        await getAllMarkdownFiles(itemPath, files);
      } else if (item.endsWith(OBSIDIAN_CONFIG.extension)) {
        // Read markdown file
        try {
          const content = await FileSystem.readAsStringAsync(itemPath);
          files.push({
            name: item.replace(OBSIDIAN_CONFIG.extension, ""),
            path: itemPath,
            content,
            modifiedTime: (itemInfo as any).modificationTime,
          });
        } catch (readError) {
          console.error("[Obsidian] Error reading file:", itemPath, readError);
        }
      }
    }

    return files;
  } catch (error) {
    console.error("[Obsidian] Error scanning directory:", directory, error);
    return files;
  }
}

// Search for text across all markdown files
export async function searchMarkdownFiles(
  query: string,
  maxResults: number = 10
): Promise<SearchResult[]> {
  const files = await getAllMarkdownFiles();
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  for (const file of files) {
    const contentLower = file.content.toLowerCase();
    const nameLower = file.name.toLowerCase();
    const matches: string[] = [];
    let score = 0;

    // Check file name match
    if (nameLower.includes(queryLower)) {
      score += 10;
      matches.push(`File name: ${file.name}`);
    }

    // Check content matches
    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        score += 1;
        // Extract context around match
        const index = contentLower.indexOf(term);
        const start = Math.max(0, index - 50);
        const end = Math.min(file.content.length, index + term.length + 50);
        const context = file.content.substring(start, end).trim();
        if (!matches.includes(context)) {
          matches.push(`...${context}...`);
        }
      }
    }

    // Check for exact phrase match
    if (contentLower.includes(queryLower)) {
      score += 5;
    }

    if (score > 0) {
      results.push({ file, matches: matches.slice(0, 3), score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}

// Get today's date formatted for daily note filename
function getTodayFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Save a note to the Daily Notes folder
export async function saveDailyNote(
  content: string,
  title?: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const hasPermission = await requestStoragePermissions();
    if (!hasPermission) {
      return { success: false, error: "Storage permission denied" };
    }

    const dailyNotesPath = `${OBSIDIAN_CONFIG.basePath}${OBSIDIAN_CONFIG.dailyNotesFolder}`;

    // Ensure Daily Notes folder exists
    const folderInfo = await FileSystem.getInfoAsync(dailyNotesPath);
    if (!folderInfo.exists) {
      await FileSystem.makeDirectoryAsync(dailyNotesPath, { intermediates: true });
    }

    // Generate filename
    const dateStr = getTodayFilename();
    const filename = title ? `${dateStr} - ${title}` : dateStr;
    const filePath = `${dailyNotesPath}/${filename}${OBSIDIAN_CONFIG.extension}`;

    // Check if file exists and append or create
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      // Append to existing daily note
      const existingContent = await FileSystem.readAsStringAsync(filePath);
      const timestamp = new Date().toLocaleTimeString();
      const newContent = `${existingContent}\n\n---\n\n## ${timestamp}\n\n${content}`;
      await FileSystem.writeAsStringAsync(filePath, newContent);
    } else {
      // Create new daily note
      const timestamp = new Date().toLocaleTimeString();
      const header = `# ${filename}\n\n## ${timestamp}\n\n${content}`;
      await FileSystem.writeAsStringAsync(filePath, header);
    }

    console.log("[Obsidian] Saved note to:", filePath);
    return { success: true, path: filePath };
  } catch (error) {
    console.error("[Obsidian] Error saving note:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save note",
    };
  }
}

// Read a specific markdown file
export async function readMarkdownFile(
  path: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(path);
    if (!fileInfo.exists) {
      return { success: false, error: "File not found" };
    }

    const content = await FileSystem.readAsStringAsync(path);
    return { success: true, content };
  } catch (error) {
    console.error("[Obsidian] Error reading file:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read file",
    };
  }
}

// Get summary of vault contents
export async function getVaultSummary(): Promise<{
  totalFiles: number;
  folders: string[];
  recentFiles: MarkdownFile[];
}> {
  const files = await getAllMarkdownFiles();
  const folders = new Set<string>();

  for (const file of files) {
    const folder = file.path
      .replace(OBSIDIAN_CONFIG.basePath, "")
      .split("/")
      .slice(0, -1)
      .join("/");
    if (folder) {
      folders.add(folder);
    }
  }

  // Sort by modified time and get recent files
  const recentFiles = files
    .sort((a, b) => (b.modifiedTime || 0) - (a.modifiedTime || 0))
    .slice(0, 10);

  return {
    totalFiles: files.length,
    folders: Array.from(folders),
    recentFiles,
  };
}
