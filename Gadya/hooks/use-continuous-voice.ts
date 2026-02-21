import { useState, useEffect, useCallback, useRef } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Speech from "expo-speech";

// Conditionally import Voice only on native platforms
let Voice: any = null;
if (Platform.OS !== "web") {
  try {
    Voice = require("@react-native-voice/voice").default;
  } catch (e) {
    console.log("[Voice] Native voice module not available");
  }
}

export type ContinuousVoiceStatus = 
  | "idle"           // Not active
  | "listening"      // Actively listening for speech
  | "processing"     // Processing speech / waiting for AI
  | "speaking"       // AI is speaking response
  | "paused";        // Temporarily paused (e.g., app backgrounded)

export interface UseContinuousVoiceOptions {
  onSpeechResult?: (text: string) => void;
  onError?: (error: string) => void;
  autoResumeAfterSpeaking?: boolean;
  stopCommands?: string[];
}

// Web Speech API fallback
const webSpeechRecognition = Platform.OS === "web" && typeof window !== "undefined" 
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition 
  : null;

export function useContinuousVoice(options: UseContinuousVoiceOptions = {}) {
  const {
    onSpeechResult,
    onError,
    autoResumeAfterSpeaking = true,
    stopCommands = ["stop", "стоп", "хватит", "enough", "cancel"],
  } = options;

  const [status, setStatus] = useState<ContinuousVoiceStatus>("idle");
  const [isActive, setIsActive] = useState(false);
  const [partialResults, setPartialResults] = useState<string>("");
  const [finalResult, setFinalResult] = useState<string>("");
  
  const isActiveRef = useRef(false);
  const shouldResumeRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const webRecognitionRef = useRef<any>(null);

  // Check if text contains a stop command
  const containsStopCommand = useCallback((text: string) => {
    const lowerText = text.toLowerCase().trim();
    return stopCommands.some(cmd => 
      lowerText === cmd || 
      lowerText.endsWith(cmd) ||
      lowerText.startsWith(cmd)
    );
  }, [stopCommands]);

  // Stop continuous listening
  const stopContinuousListening = useCallback(async () => {
    try {
      console.log("[Voice] Stopping continuous listening");
      isActiveRef.current = false;
      shouldResumeRef.current = false;
      setIsActive(false);
      setStatus("idle");
      
      if (Platform.OS === "web") {
        if (webRecognitionRef.current) {
          webRecognitionRef.current.stop();
          webRecognitionRef.current = null;
        }
      } else if (Voice) {
        await Voice.stop();
        await Voice.cancel();
      }
      Speech.stop();
    } catch (error) {
      console.error("[Voice] Stop error:", error);
    }
  }, []);

  // Restart listening (internal use)
  const restartListening = useCallback(async () => {
    if (!isActiveRef.current) return;
    
    try {
      console.log("[Voice] Restarting listening");
      
      if (Platform.OS === "web") {
        // Web: restart recognition
        if (webRecognitionRef.current) {
          webRecognitionRef.current.stop();
        }
        setTimeout(() => {
          if (isActiveRef.current && webSpeechRecognition) {
            const recognition = new webSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = "en-US";
            
            recognition.onstart = () => {
              setStatus("listening");
              setPartialResults("");
            };
            
            recognition.onresult = (event: any) => {
              const results = event.results;
              if (results.length > 0) {
                const transcript = results[results.length - 1][0].transcript;
                if (results[results.length - 1].isFinal) {
                  setFinalResult(transcript);
                  if (containsStopCommand(transcript)) {
                    stopContinuousListening();
                    return;
                  }
                  if (transcript.trim() && onSpeechResult) {
                    setStatus("processing");
                    onSpeechResult(transcript);
                  }
                } else {
                  setPartialResults(transcript);
                }
              }
            };
            
            recognition.onerror = (event: any) => {
              console.log("[Voice] Web recognition error:", event.error);
              if (event.error === "no-speech" && isActiveRef.current) {
                setTimeout(() => restartListening(), 500);
              }
            };
            
            recognition.onend = () => {
              if (isActiveRef.current && status !== "processing" && status !== "speaking") {
                setTimeout(() => restartListening(), 300);
              }
            };
            
            webRecognitionRef.current = recognition;
            recognition.start();
          }
        }, 300);
      } else if (Voice) {
        await Voice.stop();
        setTimeout(async () => {
          if (isActiveRef.current) {
            setStatus("listening");
            await Voice.start("en-US");
          }
        }, 300);
      }
    } catch (error) {
      console.error("[Voice] Restart error:", error);
      setTimeout(() => {
        if (isActiveRef.current) {
          restartListening();
        }
      }, 1000);
    }
  }, [containsStopCommand, onSpeechResult, stopContinuousListening, status]);

  // Initialize Voice handlers for native
  useEffect(() => {
    if (Platform.OS === "web" || !Voice) return;

    const onSpeechStart = () => {
      console.log("[Voice] Speech started");
      setStatus("listening");
      setPartialResults("");
    };

    const onSpeechEnd = () => {
      console.log("[Voice] Speech ended");
    };

    const onSpeechResults = (e: any) => {
      const results = e.value;
      if (results && results.length > 0) {
        const text = results[0] || "";
        console.log("[Voice] Final result:", text);
        setFinalResult(text);
        
        if (containsStopCommand(text)) {
          console.log("[Voice] Stop command detected");
          stopContinuousListening();
          return;
        }
        
        if (text.trim() && onSpeechResult) {
          setStatus("processing");
          onSpeechResult(text);
        }
      }
    };

    const onSpeechPartialResults = (e: any) => {
      const results = e.value;
      if (results && results.length > 0) {
        setPartialResults(results[0] || "");
      }
    };

    const onSpeechError = (e: any) => {
      console.log("[Voice] Error:", e.error);
      
      if (e.error?.code === "7" || e.error?.message?.includes("No match")) {
        if (isActiveRef.current) {
          restartListening();
        }
        return;
      }
      
      if (e.error?.code === "5" || e.error?.message?.includes("Client side error")) {
        if (isActiveRef.current) {
          setTimeout(() => restartListening(), 500);
        }
        return;
      }
      
      onError?.(e.error?.message || "Speech recognition error");
    };

    // Register handlers safely
    if (Voice) {
      Voice.onSpeechStart = onSpeechStart;
      Voice.onSpeechEnd = onSpeechEnd;
      Voice.onSpeechResults = onSpeechResults;
      Voice.onSpeechPartialResults = onSpeechPartialResults;
      Voice.onSpeechError = onSpeechError;
    }

    return () => {
      if (Voice) {
        Voice.destroy().then(() => {
          if (Voice.removeAllListeners) {
            Voice.removeAllListeners();
          }
        }).catch(console.error);
      }
    };
  }, [onSpeechResult, onError, containsStopCommand, stopContinuousListening, restartListening]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        if (shouldResumeRef.current && isActiveRef.current) {
          console.log("[Voice] Resuming after foreground");
          restartListening();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        if (isActiveRef.current) {
          shouldResumeRef.current = true;
          if (Platform.OS !== "web" && Voice) {
            Voice.stop();
          }
          setStatus("paused");
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription?.remove();
  }, [restartListening]);

  // Start continuous listening
  const startContinuousListening = useCallback(async () => {
    try {
      console.log("[Voice] Starting continuous listening");
      isActiveRef.current = true;
      setIsActive(true);
      setStatus("listening");
      
      if (Platform.OS === "web") {
        if (!webSpeechRecognition) {
          throw new Error("Speech recognition not available in this browser");
        }
        restartListening();
      } else if (Voice) {
        const isAvailable = await Voice.isAvailable();
        if (!isAvailable) {
          throw new Error("Speech recognition not available on this device");
        }
        await Voice.start("en-US");
      } else {
        throw new Error("Speech recognition not available");
      }
    } catch (error) {
      console.error("[Voice] Start error:", error);
      onError?.(error instanceof Error ? error.message : "Failed to start voice recognition");
      setStatus("idle");
      isActiveRef.current = false;
      setIsActive(false);
    }
  }, [onError, restartListening]);

  // Speak text and optionally resume listening after
  const speak = useCallback(async (text: string, onComplete?: () => void) => {
    if (!text.trim()) {
      if (autoResumeAfterSpeaking && isActiveRef.current) {
        restartListening();
      }
      onComplete?.();
      return;
    }

    try {
      // Stop any current listening while speaking
      if (Platform.OS === "web") {
        if (webRecognitionRef.current) {
          webRecognitionRef.current.stop();
        }
      } else if (Voice) {
        await Voice.stop();
      }
      setStatus("speaking");

      Speech.speak(text, {
        language: "en-US",
        rate: 0.9,
        onDone: () => {
          console.log("[Voice] Speech completed");
          onComplete?.();
          
          if (autoResumeAfterSpeaking && isActiveRef.current) {
            setTimeout(() => {
              restartListening();
            }, 500);
          } else {
            setStatus(isActiveRef.current ? "listening" : "idle");
          }
        },
        onError: (error) => {
          console.error("[Voice] TTS error:", error);
          onComplete?.();
          
          if (autoResumeAfterSpeaking && isActiveRef.current) {
            restartListening();
          }
        },
      });
    } catch (error) {
      console.error("[Voice] Speak error:", error);
      onComplete?.();
      
      if (autoResumeAfterSpeaking && isActiveRef.current) {
        restartListening();
      }
    }
  }, [autoResumeAfterSpeaking, restartListening]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    Speech.stop();
    if (isActiveRef.current) {
      restartListening();
    } else {
      setStatus("idle");
    }
  }, [restartListening]);

  // Set processing state (called externally when waiting for AI)
  const setProcessing = useCallback(() => {
    setStatus("processing");
  }, []);

  // Resume listening after external processing
  const resumeListening = useCallback(() => {
    if (isActiveRef.current) {
      restartListening();
    }
  }, [restartListening]);

  return {
    status,
    isActive,
    partialResults,
    finalResult,
    startContinuousListening,
    stopContinuousListening,
    speak,
    stopSpeaking,
    setProcessing,
    resumeListening,
  };
}
