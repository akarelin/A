import { Platform, AppState } from "react-native";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { Audio } from "expo-av";

const BACKGROUND_VOICE_TASK = "BACKGROUND_VOICE_TASK";

// Configure audio session for background operation
export async function configureAudioSession() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    console.log("[BackgroundVoice] Audio session configured for background");
    return true;
  } catch (error) {
    console.error("[BackgroundVoice] Failed to configure audio session:", error);
    return false;
  }
}

// Register background task
export async function registerBackgroundVoiceTask() {
  if (Platform.OS === "web") {
    console.log("[BackgroundVoice] Background tasks not supported on web");
    return false;
  }

  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_VOICE_TASK);
    if (isRegistered) {
      console.log("[BackgroundVoice] Task already registered");
      return true;
    }

    // Register background fetch task
    await BackgroundFetch.registerTaskAsync(BACKGROUND_VOICE_TASK, {
      minimumInterval: 60, // Minimum interval in seconds (iOS may throttle this)
      stopOnTerminate: false, // Continue after app is terminated (Android)
      startOnBoot: true, // Start on device boot (Android)
    });

    console.log("[BackgroundVoice] Background task registered");
    return true;
  } catch (error) {
    console.error("[BackgroundVoice] Failed to register background task:", error);
    return false;
  }
}

// Unregister background task
export async function unregisterBackgroundVoiceTask() {
  if (Platform.OS === "web") return;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_VOICE_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_VOICE_TASK);
      console.log("[BackgroundVoice] Background task unregistered");
    }
  } catch (error) {
    console.error("[BackgroundVoice] Failed to unregister background task:", error);
  }
}

// Check background fetch status
export async function getBackgroundFetchStatus(): Promise<string> {
  if (Platform.OS === "web") return "unavailable";

  try {
    const status = await BackgroundFetch.getStatusAsync();
    switch (status) {
      case BackgroundFetch.BackgroundFetchStatus.Restricted:
        return "restricted";
      case BackgroundFetch.BackgroundFetchStatus.Denied:
        return "denied";
      case BackgroundFetch.BackgroundFetchStatus.Available:
        return "available";
      default:
        return "unknown";
    }
  } catch (error) {
    console.error("[BackgroundVoice] Failed to get background fetch status:", error);
    return "error";
  }
}

// Define the background task
if (Platform.OS !== "web") {
  TaskManager.defineTask(BACKGROUND_VOICE_TASK, async () => {
    console.log("[BackgroundVoice] Background task executed");
    
    // This task runs periodically to keep the app alive
    // The actual voice recognition is handled by the native module
    // which continues running due to the audio background mode
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  });
}

// Keep-alive mechanism using silent audio playback
let keepAliveSound: Audio.Sound | null = null;

export async function startKeepAlive() {
  if (Platform.OS === "web") return;

  try {
    // Configure audio for background
    await configureAudioSession();

    // Create a silent audio loop to keep the app active
    // This is a common technique for iOS background audio
    const { sound } = await Audio.Sound.createAsync(
      { uri: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=" },
      { 
        isLooping: true,
        volume: 0.01, // Nearly silent
        shouldPlay: true,
      }
    );
    
    keepAliveSound = sound;
    console.log("[BackgroundVoice] Keep-alive audio started");
  } catch (error) {
    console.error("[BackgroundVoice] Failed to start keep-alive:", error);
  }
}

export async function stopKeepAlive() {
  if (keepAliveSound) {
    try {
      await keepAliveSound.stopAsync();
      await keepAliveSound.unloadAsync();
      keepAliveSound = null;
      console.log("[BackgroundVoice] Keep-alive audio stopped");
    } catch (error) {
      console.error("[BackgroundVoice] Failed to stop keep-alive:", error);
    }
  }
}

// Export task name for reference
export { BACKGROUND_VOICE_TASK };
