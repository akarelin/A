/**
 * Server-side Logger Service for Гадя
 * Collects and stores server logs for analysis
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ServerLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  requestId?: string;
  userId?: number;
  duration?: number;
}

export interface ClientLogBatch {
  logs: Array<{
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
  }>;
  clientInfo: {
    platform: string;
    version: string;
    sessionId: string;
  };
}

class ServerLogger {
  private logs: ServerLogEntry[] = [];
  private clientLogs: ClientLogBatch["logs"] = [];
  private maxLogs = 10000;
  private maxClientLogs = 50000;

  private generateId(): string {
    return `srv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  log(
    level: LogLevel,
    category: string,
    message: string,
    options?: {
      data?: Record<string, unknown>;
      requestId?: string;
      userId?: number;
      duration?: number;
    }
  ) {
    const entry: ServerLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: options?.data,
      requestId: options?.requestId,
      userId: options?.userId,
      duration: options?.duration,
    };

    this.logs.push(entry);

    // Keep logs within limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${category}]`;
    if (level === "error") {
      console.error(prefix, message, options?.data || "");
    } else if (level === "warn") {
      console.warn(prefix, message, options?.data || "");
    } else {
      console.log(prefix, message, options?.data || "");
    }
  }

  debug(category: string, message: string, options?: Omit<Parameters<typeof this.log>[3], never>) {
    this.log("debug", category, message, options);
  }

  info(category: string, message: string, options?: Omit<Parameters<typeof this.log>[3], never>) {
    this.log("info", category, message, options);
  }

  warn(category: string, message: string, options?: Omit<Parameters<typeof this.log>[3], never>) {
    this.log("warn", category, message, options);
  }

  error(category: string, message: string, options?: Omit<Parameters<typeof this.log>[3], never>) {
    this.log("error", category, message, options);
  }

  // Log API request
  logRequest(
    method: string,
    path: string,
    options?: {
      requestId?: string;
      userId?: number;
      duration?: number;
      statusCode?: number;
      error?: string;
    }
  ) {
    const level: LogLevel = options?.error ? "error" : options?.statusCode && options.statusCode >= 400 ? "warn" : "info";
    this.log(level, "api", `${method} ${path}`, {
      data: {
        statusCode: options?.statusCode,
        error: options?.error,
      },
      requestId: options?.requestId,
      userId: options?.userId,
      duration: options?.duration,
    });
  }

  // Log LangChain/AI operations
  logAI(
    operation: string,
    options?: {
      requestId?: string;
      userId?: number;
      duration?: number;
      inputLength?: number;
      outputLength?: number;
      model?: string;
      error?: string;
    }
  ) {
    const level: LogLevel = options?.error ? "error" : "info";
    this.log(level, "ai", operation, {
      data: {
        inputLength: options?.inputLength,
        outputLength: options?.outputLength,
        model: options?.model,
        error: options?.error,
      },
      requestId: options?.requestId,
      userId: options?.userId,
      duration: options?.duration,
    });
  }

  // Receive client logs
  receiveClientLogs(batch: ClientLogBatch) {
    this.clientLogs.push(...batch.logs);
    
    // Keep client logs within limit
    if (this.clientLogs.length > this.maxClientLogs) {
      this.clientLogs = this.clientLogs.slice(-this.maxClientLogs);
    }

    this.info("telemetry", "received_client_logs", {
      data: {
        count: batch.logs.length,
        sessionId: batch.clientInfo.sessionId,
        platform: batch.clientInfo.platform,
      },
    });
  }

  // Get server logs
  getServerLogs(options?: {
    level?: LogLevel;
    category?: string;
    since?: string;
    limit?: number;
  }): ServerLogEntry[] {
    let filtered = [...this.logs];

    if (options?.level) {
      filtered = filtered.filter((log) => log.level === options.level);
    }
    if (options?.category) {
      filtered = filtered.filter((log) => log.category === options.category);
    }
    if (options?.since) {
      const sinceDate = new Date(options.since);
      filtered = filtered.filter((log) => new Date(log.timestamp) >= sinceDate);
    }

    // Return most recent first
    filtered.reverse();

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  // Get client logs
  getClientLogs(options?: {
    level?: LogLevel;
    category?: string;
    sessionId?: string;
    since?: string;
    limit?: number;
  }): ClientLogBatch["logs"] {
    let filtered = [...this.clientLogs];

    if (options?.level) {
      filtered = filtered.filter((log) => log.level === options.level);
    }
    if (options?.category) {
      filtered = filtered.filter((log) => log.category === options.category);
    }
    if (options?.sessionId) {
      filtered = filtered.filter((log) => log.context.sessionId === options.sessionId);
    }
    if (options?.since) {
      const sinceDate = new Date(options.since);
      filtered = filtered.filter((log) => new Date(log.timestamp) >= sinceDate);
    }

    // Return most recent first
    filtered.reverse();

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  // Get combined logs for analysis
  getAllLogs(options?: {
    level?: LogLevel;
    since?: string;
    limit?: number;
  }): {
    server: ServerLogEntry[];
    client: ClientLogBatch["logs"];
    stats: {
      serverTotal: number;
      clientTotal: number;
      serverByLevel: Record<LogLevel, number>;
      clientByLevel: Record<LogLevel, number>;
      uniqueSessions: number;
    };
  } {
    const serverLogs = this.getServerLogs(options);
    const clientLogs = this.getClientLogs(options);

    // Calculate stats
    const serverByLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    const clientByLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    const sessions = new Set<string>();

    for (const log of this.logs) {
      serverByLevel[log.level]++;
    }
    for (const log of this.clientLogs) {
      clientByLevel[log.level]++;
      sessions.add(log.context.sessionId);
    }

    return {
      server: serverLogs,
      client: clientLogs,
      stats: {
        serverTotal: this.logs.length,
        clientTotal: this.clientLogs.length,
        serverByLevel,
        clientByLevel,
        uniqueSessions: sessions.size,
      },
    };
  }

  // Export all logs as JSON
  exportLogs(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        server: this.logs,
        client: this.clientLogs,
      },
      null,
      2
    );
  }

  // Clear logs
  clearLogs(type?: "server" | "client" | "all") {
    if (type === "server" || type === "all" || !type) {
      this.logs = [];
    }
    if (type === "client" || type === "all" || !type) {
      this.clientLogs = [];
    }
    this.info("logger", "logs_cleared", { data: { type: type || "all" } });
  }
}

// Singleton instance
export const logger = new ServerLogger();

export default logger;
