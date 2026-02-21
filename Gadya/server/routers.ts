import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import {
  runChatChain,
  runRephraseChain,
  runSummarizeChain,
  runRAGChain,
  runClaudeChain,
  classifyIntent,
  extractSearchQuery,
} from "./services/langchain";
import { logger } from "./services/logger";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Voice AI Assistant routes - powered by LangChain
  ai: router({
    // Chat with LLM - main query endpoint using LangChain
    chat: publicProcedure
      .input(
        z.object({
          message: z.string().min(1),
          context: z.string().optional(),
          conversationHistory: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string(),
              })
            )
            .optional(),
        })
      )
      .mutation(async ({ input }) => {
        console.log("[AI] Chat request via LangChain:", input.message.substring(0, 50));
        
        const response = await runChatChain({
          input: input.message,
          context: input.context,
          history: input.conversationHistory,
        });

        return {
          response,
          usage: null, // LangChain doesn't expose usage directly
        };
      }),

    // Ask Claude - forward to Claude Opus via LangChain
    askClaude: publicProcedure
      .input(
        z.object({
          message: z.string().min(1),
          context: z.string().optional(),
          conversationHistory: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string(),
              })
            )
            .optional(),
        })
      )
      .mutation(async ({ input }) => {
        console.log("[AI] Claude request via LangChain:", input.message.substring(0, 50));
        
        const response = await runClaudeChain({
          input: input.message,
          context: input.context,
          history: input.conversationHistory,
        });

        return {
          response,
          model: "claude-sonnet-4-20250514",
        };
      }),

    // RAG-based note search using LangChain
    searchNotes: publicProcedure
      .input(
        z.object({
          query: z.string().min(1),
          noteContext: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        console.log("[AI] RAG search via LangChain:", input.query);
        
        const response = await runRAGChain({
          question: input.query,
          context: input.noteContext,
        });

        return { response };
      }),

    // Rephrase text using LangChain - for dictation editing
    rephrase: publicProcedure
      .input(
        z.object({
          text: z.string().min(1),
          style: z.enum(["formal", "casual", "concise", "expanded"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        console.log("[AI] Rephrase via LangChain, style:", input.style || "default");
        
        const rephrased = await runRephraseChain({
          text: input.text,
          style: input.style,
        });

        return { rephrased };
      }),

    // Summarize notes using LangChain
    summarize: publicProcedure
      .input(
        z.object({
          content: z.string().min(1),
          maxLength: z.enum(["brief", "medium", "detailed"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        console.log("[AI] Summarize via LangChain, length:", input.maxLength || "medium");
        
        const summary = await runSummarizeChain({
          content: input.content,
          maxLength: input.maxLength,
        });

        return { summary };
      }),

    // Classify user intent using LangChain
    classifyIntent: publicProcedure
      .input(z.object({ input: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const intent = await classifyIntent(input.input);
        return { intent };
      }),

    // Extract search query from natural language
    extractSearchQuery: publicProcedure
      .input(z.object({ input: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const query = await extractSearchQuery(input.input);
        return { query };
      }),
  }),

  // Notes management routes - no auth required for single-user app
  notes: router({
    // List all notes (uses device ID instead of user ID)
    list: publicProcedure
      .input(z.object({ deviceId: z.string().optional() }))
      .query(async ({ input }) => {
        // Use deviceId or default to 1 for single-user mode
        return db.getUserNotes(1);
      }),

    // Get a single note
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getNote(input.id, 1);
      }),

    // Create a new note
    create: publicProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          content: z.string(),
          folder: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return db.createNote({
          userId: 1, // Single-user mode
          title: input.title,
          content: input.content,
          folder: input.folder || "/",
        });
      }),

    // Update a note
    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(255).optional(),
          content: z.string().optional(),
          folder: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateNote(id, 1, data);
      }),

    // Delete a note
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteNote(input.id, 1);
      }),

    // Search notes
    search: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        return db.searchNotes(1, input.query);
      }),
  }),

  // Conversation history routes - no auth required for single-user app
  conversations: router({
    // List recent conversations
    list: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional() }))
      .query(async ({ input }) => {
        return db.getUserConversations(1, input.limit || 20);
      }),

    // Save a conversation
    save: publicProcedure
      .input(
        z.object({
          query: z.string(),
          response: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        return db.saveConversation({
          userId: 1, // Single-user mode
          query: input.query,
          response: input.response,
        });
      }),

    // Delete a conversation
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteConversation(input.id, 1);
      }),
  }),

  // Telemetry routes for log collection and analysis
  telemetry: router({
    // Receive client logs
    submitLogs: publicProcedure
      .input(
        z.object({
          logs: z.array(
            z.object({
              id: z.string(),
              timestamp: z.string(),
              level: z.enum(["debug", "info", "warn", "error"]),
              category: z.string(),
              message: z.string(),
              data: z.record(z.string(), z.unknown()).optional(),
              context: z.object({
                platform: z.string(),
                version: z.string(),
                sessionId: z.string(),
                userId: z.string().optional(),
              }),
            })
          ),
          clientInfo: z.object({
            platform: z.string(),
            version: z.string(),
            sessionId: z.string(),
          }),
        })
      )
      .mutation(async ({ input }) => {
        logger.receiveClientLogs(input);
        return { success: true, received: input.logs.length };
      }),

    // Get server logs (protected - for admin/analysis)
    getServerLogs: protectedProcedure
      .input(
        z.object({
          level: z.enum(["debug", "info", "warn", "error"]).optional(),
          category: z.string().optional(),
          since: z.string().optional(),
          limit: z.number().min(1).max(1000).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return logger.getServerLogs(input || {});
      }),

    // Get client logs (protected - for admin/analysis)
    getClientLogs: protectedProcedure
      .input(
        z.object({
          level: z.enum(["debug", "info", "warn", "error"]).optional(),
          category: z.string().optional(),
          sessionId: z.string().optional(),
          since: z.string().optional(),
          limit: z.number().min(1).max(1000).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return logger.getClientLogs(input || {});
      }),

    // Get all logs with stats (protected - for admin/analysis)
    getAllLogs: protectedProcedure
      .input(
        z.object({
          level: z.enum(["debug", "info", "warn", "error"]).optional(),
          since: z.string().optional(),
          limit: z.number().min(1).max(1000).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return logger.getAllLogs(input || {});
      }),

    // Export all logs as JSON (protected - for admin/analysis)
    exportLogs: protectedProcedure.query(async () => {
      return { json: logger.exportLogs() };
    }),

    // Clear logs (protected - for admin)
    clearLogs: protectedProcedure
      .input(
        z.object({
          type: z.enum(["server", "client", "all"]).optional(),
        }).optional()
      )
      .mutation(async ({ input }) => {
        logger.clearLogs(input?.type);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
