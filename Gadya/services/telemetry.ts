/**
 * Telemetry Service for Гадя
 * Collects client-side logs and events for analysis
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";

const TELEMETRY_STORAGE_KEY = "@gadya_telemetry_logs";
const MAX_LOCAL_LOGS = 500;
const BATCH_SIZE = 50;

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface TelemetryEvent {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  context: {
    platform: string;
    version: string;
    sessionId: string;
    userId?: string;
  };
}

class TelemetryService {
  private sessionId: string;
  private userId?: string;
  private buffer: TelemetryEvent[] = [];
  private isInitialized = false;
  private serverEndpoint?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  async initialize(options?: { serverEndpoint?: string; userId?: string }) {
    if (this.isInitialized) return;
    
    this.serverEndpoint = options?.serverEndpoint;
    this.userId = options?.userId;
    this.isInitialized = true;

    // Load any persisted logs
    await this.loadPersistedLogs();

    this.log("info", "telemetry", "Telemetry service initialized", {
      sessionId: this.sessionId,
      platform: Platform.OS,
    });
  }

  setUserId(userId: string) {
    this.userId = userId;
    this.log("info", "telemetry", "User ID set", { userId });
  }

  private createEvent(
    level: LogLevel,
    category: string,
    message: string,
    data?: Record<string, unknown>
  ): TelemetryEvent {
    return {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      context: {
        platform: Platform.OS,
        version: Constants.expoConfig?.version || "unknown",
        sessionId: this.sessionId,
        userId: this.userId,
      },
    };
  }

  log(
    level: LogLevel,
    category: string,
    message: string,
    data?: Record<string, unknown>
  ) {
    const event = this.createEvent(level, category, message, data);
    this.buffer.push(event);

    // Also log to console in development
    if (__DEV__) {
      const consoleMethod = level === "error" ? console.error : 
                           level === "warn" ? console.warn : 
                           console.log;
      consoleMethod(`[${level.toUpperCase()}] [${category}] ${message}`, data || "");
    }

    // Persist and potentially flush
    this.persistLogs();
    
    if (this.buffer.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  // Convenience methods
  debug(category: string, message: string, data?: Record<string, unknown>) {
    this.log("debug", category, message, data);
  }

  info(category: string, message: string, data?: Record<string, unknown>) {
    this.log("info", category, message, data);
  }

  warn(category: string, message: string, data?: Record<string, unknown>) {
    this.log("warn", category, message, data);
  }

  error(category: string, message: string, data?: Record<string, unknown>) {
    this.log("error", category, message, data);
  }

  // Voice-specific logging
  logVoiceEvent(event: string, data?: Record<string, unknown>) {
    this.info("voice", event, data);
  }

  logAIQuery(query: string, responseTime: number, success: boolean) {
    this.info("ai", "query_completed", {
      queryLength: query.length,
      responseTime,
      success,
    });
  }

  logNavigation(screen: string, params?: Record<string, unknown>) {
    this.info("navigation", `navigated_to_${screen}`, params);
  }

  logError(error: Error, context?: string) {
    this.error("error", context || "unhandled_error", {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500),
    });
  }

  private async persistLogs() {
    try {
      // Keep only the most recent logs
      const logsToStore = this.buffer.slice(-MAX_LOCAL_LOGS);
      await AsyncStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(logsToStore));
    } catch (e) {
      console.error("Failed to persist telemetry logs:", e);
    }
  }

  private async loadPersistedLogs() {
    try {
      const stored = await AsyncStorage.getItem(TELEMETRY_STORAGE_KEY);
      if (stored) {
        const logs = JSON.parse(stored) as TelemetryEvent[];
        this.buffer = logs;
      }
    } catch (e) {
      console.error("Failed to load persisted telemetry logs:", e);
    }
  }

  async flush(): Promise<boolean> {
    if (this.buffer.length === 0) return true;
    if (!this.serverEndpoint) {
      // No server endpoint configured, just keep logs locally
      return true;
    }

    const logsToSend = [...this.buffer];
    
    try {
      const response = await fetch(this.serverEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logs: logsToSend,
          clientInfo: {
            platform: Platform.OS,
            version: Constants.expoConfig?.version,
            sessionId: this.sessionId,
          },
        }),
      });

      if (response.ok) {
        // Clear sent logs from buffer
        this.buffer = this.buffer.filter(
          (log) => !logsToSend.some((sent) => sent.id === log.id)
        );
        await this.persistLogs();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to flush telemetry logs:", e);
      return false;
    }
  }

  // Get all logs for export/analysis
  async getAllLogs(): Promise<TelemetryEvent[]> {
    return [...this.buffer];
  }

  // Export logs as JSON string
  async exportLogs(): Promise<string> {
    const logs = await this.getAllLogs();
    return JSON.stringify(logs, null, 2);
  }

  // Clear all logs
  async clearLogs() {
    this.buffer = [];
    await AsyncStorage.removeItem(TELEMETRY_STORAGE_KEY);
    this.info("telemetry", "logs_cleared", {});
  }

  // Get log statistics
  getStats(): {
    totalLogs: number;
    byLevel: Record<LogLevel, number>;
    byCategory: Record<string, number>;
    sessionDuration: number;
  } {
    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };
    const byCategory: Record<string, number> = {};

    for (const log of this.buffer) {
      byLevel[log.level]++;
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    }

    const firstLog = this.buffer[0];
    const sessionDuration = firstLog
      ? Date.now() - new Date(firstLog.timestamp).getTime()
      : 0;

    return {
      totalLogs: this.buffer.length,
      byLevel,
      byCategory,
      sessionDuration,
    };
  }
}

// Singleton instance
export const telemetry = new TelemetryService();

// Default export for convenience
export default telemetry;
