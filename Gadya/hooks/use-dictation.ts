import { useState, useCallback, useRef } from "react";
import { useVoice } from "./use-voice";
import { trpc } from "@/lib/trpc";

export type DictationMode = "idle" | "recording" | "paused" | "editing";

interface UseDictationOptions {
  onError?: (error: string) => void;
}

export function useDictation(options: UseDictationOptions = {}) {
  const [mode, setMode] = useState<DictationMode>("idle");
  const [text, setText] = useState("");
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const textHistoryRef = useRef<string[]>([]);

  const voice = useVoice({
    onError: options.onError,
  });

  const rephraseMutation = trpc.ai.rephrase.useMutation();

  // Start recording
  const startRecording = useCallback(async () => {
    await voice.startListening();
    setMode("recording");
  }, [voice]);

  // Stop recording and process
  const stopRecording = useCallback(async () => {
    const audioUri = await voice.stopListening();
    if (audioUri) {
      // For now, we'll simulate transcription
      // In production, this would upload audio and call transcription API
      setMode("paused");
    }
    return audioUri;
  }, [voice]);

  // Pause recording
  const pauseRecording = useCallback(async () => {
    await voice.stopListening();
    setMode("paused");
  }, [voice]);

  // Resume recording
  const resumeRecording = useCallback(async () => {
    await voice.startListening();
    setMode("recording");
  }, [voice]);

  // Add transcribed text
  const addText = useCallback((newText: string) => {
    setText((prev) => {
      const updated = prev ? `${prev} ${newText}` : newText;
      textHistoryRef.current.push(prev);
      return updated;
    });
  }, []);

  // Replace text at selection or append
  const replaceText = useCallback(
    (newText: string) => {
      if (selectedRange) {
        setText((prev) => {
          textHistoryRef.current.push(prev);
          return (
            prev.substring(0, selectedRange.start) + newText + prev.substring(selectedRange.end)
          );
        });
        setSelectedRange(null);
      } else {
        addText(newText);
      }
    },
    [selectedRange, addText]
  );

  // Undo last change
  const undo = useCallback(() => {
    if (textHistoryRef.current.length > 0) {
      const previousText = textHistoryRef.current.pop();
      if (previousText !== undefined) {
        setText(previousText);
      }
    }
  }, []);

  // Clear all text
  const clearText = useCallback(() => {
    textHistoryRef.current.push(text);
    setText("");
    setSelectedRange(null);
  }, [text]);

  // Read back text using TTS
  const readBack = useCallback(
    async (portion?: "all" | "selection" | "last-paragraph") => {
      let textToRead = "";

      switch (portion) {
        case "selection":
          if (selectedRange) {
            textToRead = text.substring(selectedRange.start, selectedRange.end);
          }
          break;
        case "last-paragraph":
          const paragraphs = text.split("\n\n").filter((p) => p.trim());
          textToRead = paragraphs[paragraphs.length - 1] || "";
          break;
        case "all":
        default:
          textToRead = text;
      }

      if (textToRead) {
        await voice.speak(textToRead);
      }
    },
    [text, selectedRange, voice]
  );

  // Rephrase selected text or all text
  const rephrase = useCallback(
    async (style?: "formal" | "casual" | "concise" | "expanded") => {
      const textToRephrase = selectedRange
        ? text.substring(selectedRange.start, selectedRange.end)
        : text;

      if (!textToRephrase.trim()) {
        options.onError?.("No text to rephrase");
        return;
      }

      setIsProcessing(true);
      try {
        const result = await rephraseMutation.mutateAsync({
          text: textToRephrase,
          style,
        });

        if (result.rephrased) {
          if (selectedRange) {
            textHistoryRef.current.push(text);
            setText(
              text.substring(0, selectedRange.start) +
                result.rephrased +
                text.substring(selectedRange.end)
            );
          } else {
            textHistoryRef.current.push(text);
            setText(result.rephrased);
          }
        }

        return result.rephrased;
      } catch (error) {
        options.onError?.("Failed to rephrase text");
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [text, selectedRange, rephraseMutation, options]
  );

  // Get paragraph at index
  const getParagraph = useCallback(
    (index: number) => {
      const paragraphs = text.split("\n\n").filter((p) => p.trim());
      return paragraphs[index] || null;
    },
    [text]
  );

  // Select paragraph by index
  const selectParagraph = useCallback(
    (index: number) => {
      const paragraphs = text.split("\n\n");
      let currentPos = 0;

      for (let i = 0; i < paragraphs.length; i++) {
        if (i === index) {
          setSelectedRange({
            start: currentPos,
            end: currentPos + paragraphs[i].length,
          });
          return;
        }
        currentPos += paragraphs[i].length + 2; // +2 for \n\n
      }
    },
    [text]
  );

  // Reset dictation state
  const reset = useCallback(() => {
    setText("");
    setSelectedRange(null);
    setMode("idle");
    textHistoryRef.current = [];
    voice.cancel();
  }, [voice]);

  return {
    // State
    mode,
    text,
    selectedRange,
    isProcessing,
    voiceStatus: voice.status,
    isSpeaking: voice.isSpeaking,

    // Recording controls
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,

    // Text manipulation
    setText,
    addText,
    replaceText,
    undo,
    clearText,
    setSelectedRange,

    // Voice features
    readBack,
    rephrase,
    stopSpeaking: voice.stopSpeaking,

    // Paragraph operations
    getParagraph,
    selectParagraph,

    // Reset
    reset,
  };
}
