import { Notice, Plugin } from "obsidian";
import { OpenClawClient } from "./openclaw-client";
import { ChmoChatView, VIEW_TYPE_CHMO } from "./chat-view";
import { ChmoSettingTab, DEFAULT_SETTINGS, type ChmoSettings } from "./settings";
import { DashboardAPI } from "./dashboard";
import { runClaude, extractText, type ClaudeEvent } from "./claude-local";
import { homedir } from "os";

export default class ChmoPlugin extends Plugin {
	settings!: ChmoSettings;
	client!: OpenClawClient;
	dashboard!: DashboardAPI;

	/** Check if the gateway is connected (instance-bound for DataviewJS) */
	isConnected = (): boolean => this.client?.isConnected() ?? false;

	async onload() {
		await this.loadSettings();

		this.client = new OpenClawClient({
			gatewayUrl: this.settings.gatewayUrl,
			token: this.settings.token,
		});

		this.dashboard = new DashboardAPI(this.client);
		this.dashboard.start();

		this.registerView(VIEW_TYPE_CHMO, (leaf) => new ChmoChatView(leaf, this));

		this.addRibbonIcon("message-circle", "Chmo Chat", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-chat",
			name: "Open chat",
			callback: () => this.activateView(),
		});

		this.addCommand({
			id: "new-session",
			name: "New chat session",
			callback: async () => {
				await this.activateView();
				const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHMO)[0]?.view;
				if (view instanceof ChmoChatView) {
					(view as any).createNewSession();
				}
			},
		});

		this.addSettingTab(new ChmoSettingTab(this.app, this));

		if (this.settings.autoConnect && this.settings.token) {
			setTimeout(() => {
				this.client.connect().catch((e) => {
					console.warn("Chmo: auto-connect failed:", e.message);
				});
			}, 2000);
		}
	}

	onunload() {
		this.dashboard.stop();
		this.client.disconnect();
	}

	async activateView() {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHMO);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: VIEW_TYPE_CHMO, active: true });
			this.app.workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.client.updateConfig({
			gatewayUrl: this.settings.gatewayUrl,
			token: this.settings.token,
		});
	}

	// ── Public API for DataviewJS / other plugins ──

	/**
	 * Send a message to the Chmo gateway and wait for the response.
	 * Creates a temporary session, sends the message, collects the reply.
	 *
	 * Usage from DataviewJS:
	 *   const chmo = app.plugins.plugins['chmo-chat'];
	 *   const reply = await chmo.ask("Run the extract pipeline");
	 */
	async ask(message: string, opts?: { agentId?: string; timeout?: number }): Promise<string> {
		if (!this.client.isConnected()) {
			throw new Error("Not connected to Chmo gateway");
		}

		const timeout = opts?.timeout ?? 120000;
		const session = await this.client.createSession({ agentId: opts?.agentId });

		await this.client.subscribeSession(session.key);

		try {
			await this.client.sendMessage(session.key, message);

			return await new Promise<string>((resolve, reject) => {
				let result = "";
				const timer = setTimeout(() => {
					cleanup();
					reject(new Error("Timed out waiting for response"));
				}, timeout);

				const handler = (event: any) => {
					if (event.payload?.sessionKey !== session.key) return;
					const msg = event.payload?.message;
					if (msg?.role === "assistant") {
						const content = typeof msg.content === "string"
							? msg.content
							: Array.isArray(msg.content)
								? msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
								: "";
						if (content) result = content;
					}
					const status = event.payload?.status;
					if (status === "done" || status === "failed" || status === "killed") {
						clearTimeout(timer);
						cleanup();
						resolve(result);
					}
				};

				const sessionHandler = (event: any) => {
					const sessions = event.payload?.sessions;
					if (Array.isArray(sessions)) {
						const s = sessions.find((s: any) => s.key === session.key);
						if (s && (s.status === "done" || s.status === "failed" || s.status === "killed")) {
							clearTimeout(timer);
							cleanup();
							resolve(result);
						}
					}
				};

				const cleanup = () => {
					this.client.off("session.message", handler);
					this.client.off("sessions.changed", sessionHandler);
					this.client.unsubscribeSession(session.key).catch(() => {});
				};

				this.client.on("session.message", handler);
				this.client.on("sessions.changed", sessionHandler);
			});
		} catch (e) {
			await this.client.unsubscribeSession(session.key).catch(() => {});
			throw e;
		}
	}

	/**
	 * Invoke an OpenClaw skill via the gateway agent.
	 * The agent will use the named skill to handle the request.
	 *
	 * Usage from DataviewJS:
	 *   const chmo = app.plugins.plugins['chmo-chat'];
	 *   const result = await chmo.skill("obsidian-ops", "Run extract pipeline");
	 *   const result = await chmo.skill("obsidian-ops", "synthesize", { limit: 20 });
	 *   const result = await chmo.skill("weather", "What's the weather in LA?");
	 */
	async skill(skillName: string, action: string, params?: Record<string, any>, opts?: { agentId?: string; timeout?: number }): Promise<string> {
		const paramStr = params ? "\n" + Object.entries(params).map(([k, v]) => `${k}: ${v}`).join("\n") : "";
		return this.ask(`Use the ${skillName} skill: ${action}${paramStr}`, opts);
	}

	/**
	 * Run local Claude Code CLI with a prompt.
	 * Returns structured result with session ID for conversation continuity.
	 *
	 * Usage from DataviewJS:
	 *   const chmo = app.plugins.plugins['chmo-chat'];
	 *   const { result, sessionId, cost } = await chmo.claude("Summarize the current note");
	 *   // Follow-up with conversation memory:
	 *   const r2 = await chmo.claude("Now explain the key points", { sessionId });
	 */
	async claude(prompt: string, opts?: {
		cwd?: string;
		timeout?: number;
		sessionId?: string;
		agent?: string;
		model?: string;
		onEvent?: (e: ClaudeEvent) => void;
	}): Promise<{ result: string; sessionId: string; cost: number }> {
		const cwd = opts?.cwd || (this.app.vault.adapter as any).getBasePath?.() || `${homedir()}/_`;

		return new Promise((resolve, reject) => {
			let fullText = "";

			runClaude(prompt, {
				cwd,
				timeout: opts?.timeout ?? 120000,
				sessionId: opts?.sessionId,
				agent: opts?.agent,
				model: opts?.model || this.settings.claudeModel || undefined,
				maxBudget: this.settings.claudeMaxBudget || undefined,
				permissionMode: this.settings.claudePermissionMode !== "default" ? this.settings.claudePermissionMode : undefined,

				onEvent: (event) => {
					if (event.type === "assistant" && event.message?.content) {
						const text = extractText(event.message.content);
						if (text) fullText += (fullText ? "\n" : "") + text;
					}
					opts?.onEvent?.(event);
				},

				onDone: (result) => {
					if (result?.is_error) {
						reject(new Error(result.result || "Claude failed"));
					} else {
						resolve({
							result: fullText || result?.result || "",
							sessionId: result?.session_id || "",
							cost: result?.total_cost_usd || 0,
						});
					}
				},
			});
		});
	}
}
