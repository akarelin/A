import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "../routers";
import { logger } from "../services/logger";

// Mock the logger
vi.mock("../services/logger", () => ({
  logger: {
    receiveClientLogs: vi.fn(),
    getServerLogs: vi.fn().mockReturnValue([]),
    getClientLogs: vi.fn().mockReturnValue([]),
    getAllLogs: vi.fn().mockReturnValue({
      server: [],
      client: [],
      stats: {
        serverTotal: 0,
        clientTotal: 0,
        serverByLevel: { debug: 0, info: 0, warn: 0, error: 0 },
        clientByLevel: { debug: 0, info: 0, warn: 0, error: 0 },
        uniqueSessions: 0,
      },
    }),
    exportLogs: vi.fn().mockReturnValue("{}"),
    clearLogs: vi.fn(),
  },
}));

describe("Telemetry Routes", () => {
  const mockUser = {
    id: 1,
    openId: "test-user-123",
    name: "Test User",
    email: "test@example.com",
    loginMethod: "oauth" as const,
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const createCaller = (user?: typeof mockUser) => {
    return appRouter.createCaller({
      user: user || null,
      req: {} as any,
      res: {} as any,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitLogs", () => {
    it("should accept client logs", async () => {
      const caller = createCaller();
      
      const input = {
        logs: [
          {
            id: "log-1",
            timestamp: new Date().toISOString(),
            level: "info" as const,
            category: "test",
            message: "Test log message",
            data: { key: "value" },
            context: {
              platform: "android",
              version: "1.0.0",
              sessionId: "session-123",
              userId: "user-456",
            },
          },
        ],
        clientInfo: {
          platform: "android",
          version: "1.0.0",
          sessionId: "session-123",
        },
      };

      const result = await caller.telemetry.submitLogs(input);

      expect(result.success).toBe(true);
      expect(result.received).toBe(1);
      expect(logger.receiveClientLogs).toHaveBeenCalledWith(input);
    });

    it("should accept logs without optional data field", async () => {
      const caller = createCaller();
      
      const input = {
        logs: [
          {
            id: "log-2",
            timestamp: new Date().toISOString(),
            level: "warn" as const,
            category: "voice",
            message: "Voice recognition warning",
            context: {
              platform: "ios",
              version: "1.0.0",
              sessionId: "session-789",
            },
          },
        ],
        clientInfo: {
          platform: "ios",
          version: "1.0.0",
          sessionId: "session-789",
        },
      };

      const result = await caller.telemetry.submitLogs(input);

      expect(result.success).toBe(true);
      expect(result.received).toBe(1);
    });
  });

  describe("getServerLogs (protected)", () => {
    it("should return server logs for authenticated user", async () => {
      const caller = createCaller(mockUser);
      
      const result = await caller.telemetry.getServerLogs({});

      expect(result).toEqual([]);
      expect(logger.getServerLogs).toHaveBeenCalled();
    });

    it("should throw for unauthenticated user", async () => {
      const caller = createCaller();
      
      await expect(caller.telemetry.getServerLogs({})).rejects.toThrow();
    });
  });

  describe("getClientLogs (protected)", () => {
    it("should return client logs for authenticated user", async () => {
      const caller = createCaller(mockUser);
      
      const result = await caller.telemetry.getClientLogs({});

      expect(result).toEqual([]);
      expect(logger.getClientLogs).toHaveBeenCalled();
    });
  });

  describe("getAllLogs (protected)", () => {
    it("should return all logs with stats for authenticated user", async () => {
      const caller = createCaller(mockUser);
      
      const result = await caller.telemetry.getAllLogs({});

      expect(result).toHaveProperty("server");
      expect(result).toHaveProperty("client");
      expect(result).toHaveProperty("stats");
      expect(result.stats).toHaveProperty("serverTotal");
      expect(result.stats).toHaveProperty("clientTotal");
      expect(result.stats).toHaveProperty("uniqueSessions");
    });
  });

  describe("exportLogs (protected)", () => {
    it("should return exported logs as JSON string", async () => {
      const caller = createCaller(mockUser);
      
      const result = await caller.telemetry.exportLogs();

      expect(result).toHaveProperty("json");
      expect(logger.exportLogs).toHaveBeenCalled();
    });
  });

  describe("clearLogs (protected)", () => {
    it("should clear logs", async () => {
      const caller = createCaller(mockUser);
      
      const result = await caller.telemetry.clearLogs({ type: "all" });

      expect(result.success).toBe(true);
      expect(logger.clearLogs).toHaveBeenCalledWith("all");
    });
  });
});
