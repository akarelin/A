import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  configureAudioSession,
  startKeepAlive,
  stopKeepAlive,
  registerBackgroundVoiceTask,
} from "@/services/background-voice";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { VoiceButton } from "@/components/voice-button";
import { ResponseCard } from "@/components/response-card";
import { Colors, Spacing, BorderRadius, VoiceColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useContinuousVoice, ContinuousVoiceStatus } from "@/hooks/use-continuous-voice";
import { useObsidian } from "@/hooks/use-obsidian";
import { trpc } from "@/lib/trpc";
import { telemetry } from "@/services/telemetry";

interface Conversation {
  id: string;
  query: string;
  response: string;
  timestamp: Date;
}

type AppMode = "ask" | "dictate";

const SETTINGS_KEY = "gadya_settings";
const CONVERSATIONS_KEY = "gadya_conversations";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [mode, setMode] = useState<AppMode>("ask");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentQuery, setCurrentQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [autoListen, setAutoListen] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  const chatMutation = trpc.ai.chat.useMutation();
  const claudeMutation = trpc.ai.askClaude.useMutation();

  // Obsidian file integration
  const obsidian = useObsidian();

  // Load settings and conversation history on app start
  useEffect(() => {
    // Load settings
    AsyncStorage.getItem(SETTINGS_KEY).then((data) => {
      if (data) {
        const settings = JSON.parse(data);
        setAutoListen(settings.autoListen ?? true);
      }
    });

    // Load conversation history
    AsyncStorage.getItem(CONVERSATIONS_KEY).then((data) => {
      if (data) {
        try {
          const saved = JSON.parse(data);
          // Convert timestamp strings back to Date objects
          const restored = saved.map((c: any) => ({
            ...c,
            timestamp: new Date(c.timestamp),
          }));
          setConversations(restored);
          console.log(`[Home] Loaded ${restored.length} conversations from storage`);
        } catch (e) {
          console.error("[Home] Failed to parse saved conversations:", e);
        }
      }
    });

    // Configure audio session for background operation
    configureAudioSession();
    registerBackgroundVoiceTask();

    // Initialize telemetry
    telemetry.initialize({
      serverEndpoint: undefined, // Will use tRPC instead
    });
    telemetry.logNavigation("home");
  }, []);

  // Save conversations to storage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
        .then(() => console.log(`[Home] Saved ${conversations.length} conversations`))
        .catch((e) => console.error("[Home] Failed to save conversations:", e));
    }
  }, [conversations]);

  // Clear conversation history
  const clearHistory = useCallback(() => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to delete all conversation history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setConversations([]);
            await AsyncStorage.removeItem(CONVERSATIONS_KEY);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, []);

  // Handle speech result from continuous voice
  const handleSpeechResult = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      console.log("[Home] Speech result:", text);
      setCurrentQuery(text);

      // Auto-submit in ask mode
      if (mode === "ask") {
        handleSubmitQuery(text);
      }
    },
    [mode]
  );

  // Continuous voice hook
  const voice = useContinuousVoice({
    onSpeechResult: handleSpeechResult,
    onError: (error) => {
      console.error("[Home] Voice error:", error);
      // Don't show alert for common errors
      if (!error.includes("No match") && !error.includes("Client side")) {
        Alert.alert("Voice Error", error);
      }
    },
    autoResumeAfterSpeaking: autoListen,
    stopCommands: ["stop", "стоп", "хватит", "enough", "cancel", "отмена"],
  });

  // Map continuous voice status to VoiceButton status
  const getButtonStatus = (): "idle" | "listening" | "processing" | "speaking" => {
    switch (voice.status) {
      case "listening":
        return "listening";
      case "processing":
        return "processing";
      case "speaking":
        return "speaking";
      case "paused":
        return "idle";
      default:
        return "idle";
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (voice.status) {
      case "listening":
        return voice.partialResults || "Listening...";
      case "processing":
        return "Thinking...";
      case "speaking":
        return "Speaking...";
      case "paused":
        return "Paused (tap to resume)";
      default:
        return voice.isActive ? "Ready to listen" : "Tap to start";
    }
  };

  // Handle voice button press
  const handleVoicePress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    telemetry.logVoiceEvent("voice_button_pressed", { isActive: voice.isActive });

    if (voice.isActive) {
      // Stop continuous listening and background keep-alive
      await stopKeepAlive();
      await voice.stopContinuousListening();
    } else {
      // Start background keep-alive and continuous listening
      await startKeepAlive();
      await voice.startContinuousListening();
    }
  }, [voice]);

  // Detect if query is asking for Claude
  const isClaudeRequest = (query: string): { isClaude: boolean; cleanQuery: string } => {
    const claudePatterns = [
      /^ask\s+claude[,:]?\s*/i,
      /^hey\s+claude[,:]?\s*/i,
      /^claude[,:]?\s*/i,
      /^спроси\s+клод[,:]?\s*/i,
      /^клод[,:]?\s*/i,
    ];
    
    for (const pattern of claudePatterns) {
      if (pattern.test(query)) {
        return {
          isClaude: true,
          cleanQuery: query.replace(pattern, "").trim(),
        };
      }
    }
    return { isClaude: false, cleanQuery: query };
  };

  // Submit query to AI
  const handleSubmitQuery = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      const startTime = Date.now();
      telemetry.logVoiceEvent("query_started", { queryLength: query.length });

      voice.setProcessing();
      setCurrentQuery("");

      try {
        // Check if this is a Claude request
        const { isClaude, cleanQuery } = isClaudeRequest(query);
        const actualQuery = isClaude ? cleanQuery : query;

        // Check if query mentions notes/search and get context from Obsidian
        let context = "";
        const notesKeywords = ["notes", "note", "заметк", "search", "поиск", "find", "найди", "my", "мои"];
        const queryLower = actualQuery.toLowerCase();
        const mentionsNotes = notesKeywords.some(kw => queryLower.includes(kw));

        if (mentionsNotes && obsidian.isAvailable) {
          console.log("[Home] Query mentions notes, searching Obsidian...");
          context = await obsidian.getContextForQuery(actualQuery);
          if (context) {
            console.log("[Home] Found context from Obsidian notes");
          }
        }

        // Route to Claude or default LLM
        let result;
        if (isClaude) {
          console.log("[Home] Routing to Claude:", actualQuery.substring(0, 50));
          result = await claudeMutation.mutateAsync({
            message: actualQuery,
            context: context || undefined,
            conversationHistory: conversations.slice(-5).map((c) => [
              { role: "user" as const, content: c.query },
              { role: "assistant" as const, content: c.response },
            ]).flat(),
          });
        } else {
          result = await chatMutation.mutateAsync({
            message: actualQuery,
            context: context || undefined,
            conversationHistory: conversations.slice(-5).map((c) => [
              { role: "user" as const, content: c.query },
              { role: "assistant" as const, content: c.response },
            ]).flat(),
          });
        }

        const newConversation: Conversation = {
          id: Date.now().toString(),
          query,
          response: result.response,
          timestamp: new Date(),
        };

        setConversations((prev) => [...prev, newConversation]);

        // Speak the response (will auto-resume listening after if enabled)
        setSpeakingId(newConversation.id);
        voice.speak(result.response, () => {
          setSpeakingId(null);
        });

        // Log successful query
        telemetry.logAIQuery(query, Date.now() - startTime, true);

        // Scroll to bottom
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } catch (error) {
        console.error("[Home] Chat error:", error);
        telemetry.logError(error as Error, "chat_query_failed");
        Alert.alert("Error", "Failed to get response. Please try again.");
        voice.resumeListening();
      }
    },
    [chatMutation, claudeMutation, conversations, voice, obsidian]
  );

  // Handle play/pause for a response
  const handlePlayPause = useCallback(
    (conversation: Conversation) => {
      if (speakingId === conversation.id) {
        voice.stopSpeaking();
        setSpeakingId(null);
      } else {
        voice.stopSpeaking();
        setSpeakingId(conversation.id);
        voice.speak(conversation.response, () => {
          setSpeakingId(null);
        });
      }
    },
    [speakingId, voice]
  );

  // Handle copy
  const handleCopy = useCallback((text: string) => {
    Clipboard.setString(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Handle text input submit
  const handleTextSubmit = useCallback(() => {
    if (currentQuery.trim()) {
      handleSubmitQuery(currentQuery);
      setIsTyping(false);
    }
  }, [currentQuery, handleSubmitQuery]);

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.titleRow}>
          <ThemedText type="title" style={styles.title}>
            Гадя
          </ThemedText>
          {conversations.length > 0 && (
            <Pressable
              style={[styles.clearButton, { backgroundColor: colors.inputBackground }]}
              onPress={clearHistory}
            >
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Mode Toggle */}
        <View style={[styles.modeToggle, { backgroundColor: colors.inputBackground }]}>
          <Pressable
            style={[
              styles.modeButton,
              mode === "ask" && { backgroundColor: colors.tint },
            ]}
            onPress={() => setMode("ask")}
          >
            <ThemedText
              style={[
                styles.modeText,
                mode === "ask" && styles.modeTextActive,
              ]}
            >
              Ask AI
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.modeButton,
              mode === "dictate" && { backgroundColor: colors.tint },
            ]}
            onPress={() => setMode("dictate")}
          >
            <ThemedText
              style={[
                styles.modeText,
                mode === "dictate" && styles.modeTextActive,
              ]}
            >
              Dictate
            </ThemedText>
          </Pressable>
        </View>

        {/* Continuous Mode Indicator */}
        {voice.isActive && (
          <View style={[styles.continuousIndicator, { backgroundColor: VoiceColors.recording + "20" }]}>
            <View style={[styles.liveDot, { backgroundColor: VoiceColors.recording }]} />
            <ThemedText style={[styles.continuousText, { color: VoiceColors.recording }]}>
              Hands-free mode active
            </ThemedText>
          </View>
        )}
      </View>

      {/* Conversation Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.conversationArea}
        contentContainerStyle={styles.conversationContent}
        showsVerticalScrollIndicator={false}
      >
        {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="chatbubbles-outline"
              size={64}
              color={colors.textSecondary}
            />
            <ThemedText
              style={styles.emptyText}
              lightColor={colors.textSecondary}
              darkColor={colors.textSecondary}
            >
              {mode === "ask"
                ? "Ask me anything! Tap the microphone or type below."
                : "Start dictating by tapping the microphone."}
            </ThemedText>
            <ThemedText
              style={styles.hintText}
              lightColor={colors.textTertiary}
              darkColor={colors.textTertiary}
            >
              Say "stop" or "стоп" to end hands-free mode
            </ThemedText>
          </View>
        ) : (
          conversations.map((conv) => (
            <ResponseCard
              key={conv.id}
              query={conv.query}
              response={conv.response}
              timestamp={conv.timestamp}
              isSpeaking={speakingId === conv.id}
              onPlayPause={() => handlePlayPause(conv)}
              onCopy={() => handleCopy(conv.response)}
            />
          ))
        )}
      </ScrollView>

      {/* Bottom Controls */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.bottomControls}
      >
        {/* Text Input */}
        {isTyping ? (
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.card,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                },
              ]}
              placeholder="Type your question..."
              placeholderTextColor={colors.textSecondary}
              value={currentQuery}
              onChangeText={setCurrentQuery}
              onSubmitEditing={handleTextSubmit}
              autoFocus
              multiline
            />
            <View style={styles.inputActions}>
              <Pressable
                style={styles.inputButton}
                onPress={() => setIsTyping(false)}
              >
                <Ionicons name="mic" size={24} color={colors.tint} />
              </Pressable>
              <Pressable
                style={[styles.sendButton, { backgroundColor: colors.tint }]}
                onPress={handleTextSubmit}
                disabled={!currentQuery.trim()}
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.voiceControls,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            {/* Status Text */}
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      voice.status === "listening"
                        ? VoiceColors.recording
                        : voice.status === "processing"
                          ? VoiceColors.processing
                          : voice.status === "speaking"
                            ? VoiceColors.speaking
                            : voice.isActive
                              ? VoiceColors.recording
                              : colors.textTertiary,
                  },
                ]}
              />
              <ThemedText style={styles.statusText}>{getStatusText()}</ThemedText>
            </View>

            {/* Partial Results */}
            {voice.partialResults && voice.status === "listening" && (
              <View style={[styles.partialResults, { backgroundColor: colors.inputBackground }]}>
                <ThemedText style={styles.partialText} numberOfLines={2}>
                  {voice.partialResults}
                </ThemedText>
              </View>
            )}

            {/* Voice Button */}
            <VoiceButton
              status={getButtonStatus()}
              onPress={handleVoicePress}
              size={100}
              disabled={chatMutation.isPending}
            />

            {/* Keyboard Toggle */}
            <Pressable
              style={[styles.keyboardButton, { backgroundColor: colors.inputBackground }]}
              onPress={() => setIsTyping(true)}
            >
              <Ionicons name="keypad-outline" size={24} color={colors.tint} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: "center",
  },
  title: {
    marginBottom: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: Spacing.md,
    position: "relative",
  },
  clearButton: {
    position: "absolute",
    right: 0,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  modeToggle: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: 4,
  },
  modeButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm - 2,
  },
  modeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modeTextActive: {
    color: "#FFFFFF",
  },
  continuousIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  continuousText: {
    fontSize: 12,
    fontWeight: "600",
  },
  conversationArea: {
    flex: 1,
  },
  conversationContent: {
    paddingVertical: Spacing.md,
    flexGrow: 1,
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
  hintText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  bottomControls: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  voiceControls: {
    alignItems: "center",
    paddingTop: Spacing.lg,
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
  partialResults: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    maxWidth: "80%",
  },
  partialText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  keyboardButton: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  inputContainer: {
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  textInput: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 44,
  },
  inputActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  inputButton: {
    padding: Spacing.sm,
  },
  sendButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
  },
});
