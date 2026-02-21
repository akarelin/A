import { useState, useCallback, useRef, useEffect } from "react";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";

export type VoiceStatus = "idle" | "listening" | "processing" | "speaking";

interface UseVoiceOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoice(options: UseVoiceOptions = {}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Initialize audio mode
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.error("Failed to setup audio:", error);
      }
    };
    setupAudio();
  }, []);

  // Start recording audio
  const startListening = useCallback(async () => {
    try {
      // Request permissions
      const { status: permissionStatus } = await Audio.requestPermissionsAsync();
      if (permissionStatus !== "granted") {
        options.onError?.("Microphone permission denied");
        return;
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setStatus("listening");
    } catch (error) {
      console.error("Failed to start recording:", error);
      options.onError?.("Failed to start recording");
      setStatus("idle");
    }
  }, [options]);

  // Stop recording and get audio file
  const stopListening = useCallback(async (): Promise<string | null> => {
    try {
      if (!recordingRef.current) {
        return null;
      }

      setStatus("processing");
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      // Reset audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      return uri;
    } catch (error) {
      console.error("Failed to stop recording:", error);
      options.onError?.("Failed to stop recording");
      setStatus("idle");
      return null;
    }
  }, [options]);

  // Text-to-speech
  const speak = useCallback(
    async (text: string, onDone?: () => void) => {
      try {
        // Stop any current speech
        await Speech.stop();

        setStatus("speaking");
        setIsSpeaking(true);

        Speech.speak(text, {
          language: "en-US",
          pitch: 1.0,
          rate: 0.9,
          onDone: () => {
            setIsSpeaking(false);
            setStatus("idle");
            onDone?.();
          },
          onError: (error) => {
            console.error("Speech error:", error);
            setIsSpeaking(false);
            setStatus("idle");
            options.onError?.("Failed to speak");
          },
        });
      } catch (error) {
        console.error("Failed to speak:", error);
        setIsSpeaking(false);
        setStatus("idle");
        options.onError?.("Failed to speak");
      }
    },
    [options]
  );

  // Stop speaking
  const stopSpeaking = useCallback(async () => {
    try {
      await Speech.stop();
      setIsSpeaking(false);
      setStatus("idle");
    } catch (error) {
      console.error("Failed to stop speaking:", error);
    }
  }, []);

  // Cancel any ongoing operation
  const cancel = useCallback(async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      } catch (error) {
        console.error("Failed to cancel recording:", error);
      }
    }
    await Speech.stop();
    setStatus("idle");
    setIsSpeaking(false);
  }, []);

  // Set status manually (for external control)
  const setVoiceStatus = useCallback((newStatus: VoiceStatus) => {
    setStatus(newStatus);
  }, []);

  return {
    status,
    isSpeaking,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    cancel,
    setVoiceStatus,
  };
}

// Hook for managing speech queue
export function useSpeechQueue() {
  const [queue, setQueue] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentIndexRef = useRef(0);

  const addToQueue = useCallback((text: string) => {
    setQueue((prev) => [...prev, text]);
  }, []);

  const clearQueue = useCallback(async () => {
    await Speech.stop();
    setQueue([]);
    currentIndexRef.current = 0;
    setIsPlaying(false);
  }, []);

  const playNext = useCallback(async () => {
    if (currentIndexRef.current >= queue.length) {
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    const text = queue[currentIndexRef.current];
    
    Speech.speak(text, {
      language: "en-US",
      rate: 0.9,
      onDone: () => {
        currentIndexRef.current++;
        playNext();
      },
      onError: () => {
        currentIndexRef.current++;
        playNext();
      },
    });
  }, [queue]);

  const startPlaying = useCallback(() => {
    if (queue.length > 0 && !isPlaying) {
      currentIndexRef.current = 0;
      playNext();
    }
  }, [queue, isPlaying, playNext]);

  return {
    queue,
    isPlaying,
    addToQueue,
    clearQueue,
    startPlaying,
  };
}
