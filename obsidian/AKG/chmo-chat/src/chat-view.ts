import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import type ChmoPlugin from "./main";
import type { SessionRow } from "./openclaw-client";
import { runClaude, extractText, extractToolUse, formatToolUse, type ClaudeEvent } from "./claude-local";
import type { ChildProcess } from "child_process";
import { homedir } from "os";

export const VIEW_TYPE_CHMO = "chmo-chat-view";

interface DisplayMessage {
	role: "user" | "assistant" | "system";
	content: string;
	seq?: number;
	timestamp?: number;
}

export class ChmoChatView extends ItemView {
	private plugin: ChmoPlugin;
	private messagesEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private abortBtn!: HTMLButtonElement;
	private statusEl!: HTMLElement;
	private sessionSelectEl!: HTMLSelectElement;
	private modeToggleBtn!: HTMLButtonElement;
	private localMode = false;
	private localProcess: ChildProcess | null = null;
	private localSessionId: string | null = null;
	private localCost = 0;
	private messages: DisplayMessage[] = [];
	private currentSessionKey: string | null = null;
	private isStreaming = false;
	private streamingMessageEl: HTMLElement | null = null;
	private streamingDebounce: ReturnType<typeof setTimeout> | null = null;
	private currentRunId: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ChmoPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CHMO;
	}

	getDisplayText(): string {
		return "Chmo Chat";
	}

	getIcon(): string {
		return "message-circle";
	}

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("chmo-chat-container");

		// Header bar
		const header = container.createDiv({ cls: "chmo-header" });

		// Status indicator
		this.statusEl = header.createDiv({ cls: "chmo-status" });
		this.updateStatusIndicator();

		// Session selector
		this.sessionSelectEl = header.createEl("select", { cls: "chmo-session-select" });
		this.sessionSelectEl.addEventListener("change", () => this.onSessionChange());

		// New session button
		const newBtn = header.createEl("button", { cls: "chmo-btn chmo-btn-new", attr: { "aria-label": "New chat" } });
		setIcon(newBtn, "plus");
		newBtn.addEventListener("click", () => this.createNewSession());

		// Refresh button
		const refreshBtn = header.createEl("button", { cls: "chmo-btn", attr: { "aria-label": "Refresh sessions" } });
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.addEventListener("click", () => this.refreshSessions());

		// Mode toggle: Remote (Chmo) / Local (Claude)
		this.modeToggleBtn = header.createEl("button", { cls: "chmo-btn chmo-btn-mode", attr: { "aria-label": "Toggle local/remote" } });
		this.updateModeToggle();
		this.modeToggleBtn.addEventListener("click", () => this.toggleMode());

		// Messages area
		this.messagesEl = container.createDiv({ cls: "chmo-messages" });

		// Input area
		const inputArea = container.createDiv({ cls: "chmo-input-area" });

		// Context button row
		const inputActions = inputArea.createDiv({ cls: "chmo-input-actions" });
		const noteBtn = inputActions.createEl("button", { cls: "chmo-btn chmo-btn-sm", text: "@ Note" });
		noteBtn.addEventListener("click", () => this.insertNoteContext());

		// Textarea + buttons
		const inputRow = inputArea.createDiv({ cls: "chmo-input-row" });
		this.inputEl = inputRow.createEl("textarea", {
			cls: "chmo-input",
			attr: { placeholder: "Type a message...", rows: "1" },
		});
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.sendMessage();
			}
		});
		this.inputEl.addEventListener("input", () => this.autoResizeInput());

		const btnGroup = inputRow.createDiv({ cls: "chmo-btn-group" });

		this.sendBtn = btnGroup.createEl("button", { cls: "chmo-btn chmo-btn-send", attr: { "aria-label": "Send" } });
		setIcon(this.sendBtn, "send");
		this.sendBtn.addEventListener("click", () => this.sendMessage());

		this.abortBtn = btnGroup.createEl("button", { cls: "chmo-btn chmo-btn-abort chmo-hidden", attr: { "aria-label": "Stop" } });
		setIcon(this.abortBtn, "square");
		this.abortBtn.addEventListener("click", () => this.abortGeneration());

		// Set up event listeners
		this.setupEventListeners();

		// Connect and load sessions
		if (!this.plugin.client.isConnected()) {
			this.tryConnect();
		} else {
			this.refreshSessions();
		}
	}

	async onClose() {
		this.clearStreamingDebounce();
		if (this.currentSessionKey) {
			this.plugin.client.unsubscribeSession(this.currentSessionKey).catch(() => {});
		}
	}

	private setupEventListeners() {
		this.plugin.client.onConnectionChange = (connected) => {
			this.updateStatusIndicator();
			if (connected) {
				this.refreshSessions();
			}
		};

		this.plugin.client.on("session.message", (frame) => {
			if (frame.payload?.sessionKey !== this.currentSessionKey) return;
			this.handleSessionMessage(frame.payload);
		});

		// Listen for sessions.changed to detect run completion and refresh list
		this.plugin.client.on("sessions.changed", (frame) => {
			this.refreshSessions();
			// Check if our current session finished
			if (this.isStreaming && this.currentSessionKey) {
				const sessions = frame.payload?.sessions;
				if (Array.isArray(sessions)) {
					const current = sessions.find((s: any) => s.key === this.currentSessionKey);
					if (current && (current.status === "done" || current.status === "failed" || current.status === "killed")) {
						this.setStreaming(false);
						this.renderMessages();
					}
				}
			}
		});
	}

	private async tryConnect() {
		this.statusEl.setText("Connecting...");
		try {
			await this.plugin.client.connect();
		} catch (e: any) {
			this.statusEl.setText("Disconnected");
			new Notice(`Chmo: ${e.message}`);
		}
	}

	private updateStatusIndicator() {
		const connected = this.plugin.client.isConnected();
		this.statusEl.empty();
		const dot = this.statusEl.createSpan({ cls: `chmo-dot ${connected ? "chmo-dot-on" : "chmo-dot-off"}` });
		this.statusEl.createSpan({ text: connected ? "Connected" : "Disconnected" });
		if (!connected) {
			this.statusEl.style.cursor = "pointer";
			this.statusEl.onclick = () => this.tryConnect();
		} else {
			this.statusEl.style.cursor = "default";
			this.statusEl.onclick = null;
		}
	}

	private async refreshSessions() {
		if (!this.plugin.client.isConnected()) return;

		try {
			const { sessions } = await this.plugin.client.listSessions({ limit: 30, includeDerivedTitles: true });
			this.populateSessionSelect(sessions);
		} catch (e: any) {
			console.error("Chmo: failed to list sessions", e);
		}
	}

	private populateSessionSelect(sessions: SessionRow[]) {
		const prevKey = this.currentSessionKey;
		this.sessionSelectEl.empty();

		const placeholder = this.sessionSelectEl.createEl("option", { text: "Select a session...", attr: { value: "" } });

		// Sort by updatedAt descending
		const sorted = [...sessions]
			.filter((s) => s.kind === "direct" || !s.kind)
			.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

		for (const s of sorted) {
			const label = s.derivedTitle || s.label || s.displayName || s.key;
			const opt = this.sessionSelectEl.createEl("option", { text: label, attr: { value: s.key } });
			if (s.key === prevKey) {
				opt.selected = true;
			}
		}

		// If previous session was selected, keep it
		if (prevKey && sorted.some((s) => s.key === prevKey)) {
			this.sessionSelectEl.value = prevKey;
		} else if (sorted.length > 0 && !prevKey) {
			// Select first session
			this.sessionSelectEl.value = sorted[0].key;
			this.onSessionChange();
		}
	}

	private async onSessionChange() {
		const newKey = this.sessionSelectEl.value;
		if (!newKey || newKey === this.currentSessionKey) return;

		// Unsubscribe from previous
		if (this.currentSessionKey) {
			await this.plugin.client.unsubscribeSession(this.currentSessionKey).catch(() => {});
		}

		this.currentSessionKey = newKey;
		this.messages = [];
		this.isStreaming = false;
		this.streamingMessageEl = null;
		this.renderMessages();

		// Subscribe and load history
		try {
			await this.plugin.client.subscribeSession(newKey);
			const history = await this.plugin.client.getHistory(newKey);
			if (history.messages) {
				this.messages = history.messages
					.filter((m) => m.role === "user" || m.role === "assistant")
					.map((m) => ({
						role: m.role as "user" | "assistant",
						content: this.extractContent(m.content),
					}));
				this.renderMessages();
				this.scrollToBottom();
			}
		} catch (e: any) {
			new Notice(`Chmo: Failed to load history: ${e.message}`);
		}
	}

	private async createNewSession() {
		if (!this.plugin.client.isConnected()) {
			new Notice("Not connected to Chmo gateway");
			return;
		}

		try {
			const result = await this.plugin.client.createSession({
				agentId: this.plugin.settings.defaultAgent || undefined,
			});
			this.currentSessionKey = result.key;
			this.messages = [];
			this.renderMessages();
			await this.refreshSessions();
			this.sessionSelectEl.value = result.key;
			await this.plugin.client.subscribeSession(result.key);
			this.inputEl.focus();
		} catch (e: any) {
			new Notice(`Chmo: Failed to create session: ${e.message}`);
		}
	}

	private async sendMessage() {
		const text = this.inputEl.value.trim();
		if (!text) return;

		if (this.localMode) {
			return this.sendLocalMessage(text);
		}

		if (!this.currentSessionKey) return;
		if (!this.plugin.client.isConnected()) {
			new Notice("Not connected to Chmo gateway");
			return;
		}

		// Add user message immediately
		this.messages.push({ role: "user", content: text, timestamp: Date.now() });
		this.inputEl.value = "";
		this.autoResizeInput();
		this.renderMessages();
		this.scrollToBottom();
		this.setStreaming(true);

		try {
			const result = await this.plugin.client.sendMessage(this.currentSessionKey, text);
			this.currentRunId = result?.runId ?? null;
		} catch (e: any) {
			new Notice(`Chmo: Send failed: ${e.message}`);
			this.setStreaming(false);
		}
	}

	private async sendLocalMessage(text: string) {
		this.messages.push({ role: "user", content: text, timestamp: Date.now() });
		this.inputEl.value = "";
		this.autoResizeInput();
		this.renderMessages();
		this.scrollToBottom();
		this.setStreaming(true);

		const vaultPath = (this.app.vault.adapter as any).getBasePath?.() || `${homedir()}/_`;
		const settings = this.plugin.settings;
		let assistantText = "";

		try {
			const proc = runClaude(text, {
				cwd: vaultPath,
				sessionId: this.localSessionId || undefined,
				model: settings.claudeModel || undefined,
				maxBudget: settings.claudeMaxBudget || undefined,
				permissionMode: settings.claudePermissionMode !== "default" ? settings.claudePermissionMode : undefined,

				onEvent: (event: ClaudeEvent) => {
					if (event.type === "assistant" && event.message?.content) {
						const text = extractText(event.message.content);
						const tools = extractToolUse(event.message.content);

						// Accumulate text
						if (text) {
							assistantText += (assistantText ? "\n" : "") + text;
							const last = this.messages[this.messages.length - 1];
							if (last && last.role === "assistant") {
								last.content = assistantText;
							} else {
								this.messages.push({ role: "assistant", content: assistantText, timestamp: Date.now() });
							}
							this.renderStreamingMessage(assistantText);
						}

						// Show tool use blocks
						for (const tool of tools) {
							const fmt = formatToolUse(tool);
							const toolLine = `\n\n> **${fmt.label}**${fmt.detail ? "\n> ```\n> " + fmt.detail.slice(0, 200) + "\n> ```" : ""}`;
							assistantText += toolLine;
							const last = this.messages[this.messages.length - 1];
							if (last && last.role === "assistant") {
								last.content = assistantText;
							} else {
								this.messages.push({ role: "assistant", content: assistantText, timestamp: Date.now() });
							}
							this.renderStreamingMessage(assistantText);
						}

						this.scrollToBottom();
					}

					if (event.type === "rate_limit_event" && event.rate_limit_info) {
						const info = event.rate_limit_info;
						if (info.utilization > 0.9) {
							new Notice(`Rate limit: ${Math.round(info.utilization * 100)}% used`, 5000);
						}
					}
				},

				onDone: (result: ClaudeEvent | null) => {
					this.localProcess = null;
					this.setStreaming(false);

					if (result) {
						// Save session ID for conversation continuity
						if (result.session_id) {
							this.localSessionId = result.session_id;
						}
						// Track cost
						if (result.total_cost_usd) {
							this.localCost += result.total_cost_usd;
						}
						// Add cost footer to last message
						const last = this.messages[this.messages.length - 1];
						if (last && last.role === "assistant" && result.total_cost_usd) {
							last.content += `\n\n---\n*$${result.total_cost_usd.toFixed(4)} · ${result.duration_ms ? Math.round(result.duration_ms / 1000) + "s" : ""}*`;
						}
					}

					if (result?.is_error) {
						new Notice(`Claude: ${result.result || "Unknown error"}`, 8000);
					}

					this.renderMessages();
					this.scrollToBottom();
				},
			});
			this.localProcess = proc;
		} catch (e: any) {
			new Notice(`Claude: ${e.message}`);
			this.setStreaming(false);
		}
	}

	private toggleMode() {
		this.localMode = !this.localMode;
		this.updateModeToggle();
		// Hide/show session selector in local mode
		this.sessionSelectEl.style.display = this.localMode ? "none" : "";
	}

	private updateModeToggle() {
		this.modeToggleBtn.empty();
		if (this.localMode) {
			setIcon(this.modeToggleBtn, "terminal");
			this.modeToggleBtn.setAttribute("aria-label", "Local (Claude) — click for Remote");
			this.modeToggleBtn.addClass("chmo-mode-local");
		} else {
			setIcon(this.modeToggleBtn, "globe");
			this.modeToggleBtn.setAttribute("aria-label", "Remote (Chmo) — click for Local");
			this.modeToggleBtn.removeClass("chmo-mode-local");
		}
	}

	private async abortGeneration() {
		if (this.localMode && this.localProcess) {
			this.localProcess.kill("SIGTERM");
			this.localProcess = null;
			this.setStreaming(false);
			return;
		}
		if (this.currentSessionKey) {
			await this.plugin.client.abortSession(this.currentSessionKey);
			this.setStreaming(false);
		}
	}

	private handleSessionMessage(payload: any) {
		const msg = payload.message;
		if (!msg) return;

		const role = msg.role as string;
		const content = this.extractContent(msg.content);

		if (role === "assistant" && content) {
			// Update or append streaming message
			const lastMsg = this.messages[this.messages.length - 1];
			if (lastMsg && lastMsg.role === "assistant" && this.isStreaming) {
				lastMsg.content = content;
			} else {
				this.messages.push({ role: "assistant", content, timestamp: Date.now() });
			}
			this.renderStreamingMessage(content);

			// Reset debounce — if no more events in 3s, assume done
			this.resetStreamingDebounce();
		} else if (role === "user") {
			// Deduplicate - we already added this in sendMessage()
			const lastUser = [...this.messages].reverse().find((m) => m.role === "user");
			if (lastUser && lastUser.content === content) return;
			this.messages.push({ role: "user", content, timestamp: Date.now() });
			this.renderMessages();
		}

		// Check if run finished via status field
		if (payload.status === "done" || payload.status === "failed" || payload.status === "killed") {
			this.clearStreamingDebounce();
			this.setStreaming(false);
			this.renderMessages();
		}

		this.scrollToBottom();
	}

	private resetStreamingDebounce() {
		this.clearStreamingDebounce();
		this.streamingDebounce = setTimeout(() => {
			if (this.isStreaming) {
				this.setStreaming(false);
				this.renderMessages();
				this.scrollToBottom();
			}
		}, 3000);
	}

	private clearStreamingDebounce() {
		if (this.streamingDebounce) {
			clearTimeout(this.streamingDebounce);
			this.streamingDebounce = null;
		}
	}

	private setStreaming(streaming: boolean) {
		this.isStreaming = streaming;
		this.streamingMessageEl = null;
		if (streaming) {
			this.sendBtn.addClass("chmo-hidden");
			this.abortBtn.removeClass("chmo-hidden");
			this.inputEl.disabled = true;
		} else {
			this.sendBtn.removeClass("chmo-hidden");
			this.abortBtn.addClass("chmo-hidden");
			this.inputEl.disabled = false;
			this.inputEl.focus();
		}
	}

	private extractContent(content: any): string {
		if (typeof content === "string") return content;
		if (Array.isArray(content)) {
			return content
				.filter((b: any) => b.type === "text" && b.text)
				.map((b: any) => b.text)
				.join("\n");
		}
		return "";
	}

	private renderMessages() {
		this.messagesEl.empty();
		this.streamingMessageEl = null;

		if (this.messages.length === 0) {
			this.messagesEl.createDiv({ cls: "chmo-empty", text: "No messages yet. Start a conversation!" });
			return;
		}

		for (const msg of this.messages) {
			this.appendMessageEl(msg);
		}
	}

	private appendMessageEl(msg: DisplayMessage) {
		const wrapper = this.messagesEl.createDiv({ cls: `chmo-msg chmo-msg-${msg.role}` });
		const label = wrapper.createDiv({ cls: "chmo-msg-role" });
		label.setText(msg.role === "user" ? "You" : "Chmo");

		const body = wrapper.createDiv({ cls: "chmo-msg-body" });

		if (msg.role === "assistant") {
			// Render markdown
			MarkdownRenderer.render(this.app, msg.content, body, "", this.plugin);
		} else {
			body.setText(msg.content);
		}

		// Copy button for assistant messages
		if (msg.role === "assistant") {
			const actions = wrapper.createDiv({ cls: "chmo-msg-actions" });
			const copyBtn = actions.createEl("button", { cls: "chmo-btn chmo-btn-sm", attr: { "aria-label": "Copy" } });
			setIcon(copyBtn, "copy");
			copyBtn.addEventListener("click", () => {
				navigator.clipboard.writeText(msg.content);
				new Notice("Copied to clipboard");
			});

			const insertBtn = actions.createEl("button", { cls: "chmo-btn chmo-btn-sm", attr: { "aria-label": "Insert into note" } });
			setIcon(insertBtn, "file-input");
			insertBtn.addEventListener("click", () => this.insertIntoNote(msg.content));
		}

		return wrapper;
	}

	private renderStreamingMessage(content: string) {
		if (!this.streamingMessageEl) {
			// Create a new streaming message element
			const wrapper = this.messagesEl.createDiv({ cls: "chmo-msg chmo-msg-assistant chmo-msg-streaming" });
			const label = wrapper.createDiv({ cls: "chmo-msg-role" });
			label.setText("Chmo");
			this.streamingMessageEl = wrapper.createDiv({ cls: "chmo-msg-body" });
		}
		this.streamingMessageEl.empty();
		MarkdownRenderer.render(this.app, content, this.streamingMessageEl, "", this.plugin);
	}

	private scrollToBottom() {
		requestAnimationFrame(() => {
			this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
		});
	}

	private autoResizeInput() {
		this.inputEl.style.height = "auto";
		this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 150) + "px";
	}

	private async insertNoteContext() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active note");
			return;
		}
		const adapter = this.app.vault.adapter as any;
		const basePath: string = adapter.getBasePath ? adapter.getBasePath() : "";
		const absolutePath = basePath ? `${basePath}/${activeFile.path}` : activeFile.path;
		const prefix = `[Note: ${activeFile.basename} — ${absolutePath}]\nRead the file above and use it as context.\n\n`;
		this.inputEl.value = prefix + this.inputEl.value;
		this.autoResizeInput();
		this.inputEl.focus();
	}

	private async insertIntoNote(content: string) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active note to insert into");
			return;
		}
		const existing = await this.app.vault.read(activeFile);
		await this.app.vault.modify(activeFile, existing + "\n\n" + content);
		new Notice(`Inserted into ${activeFile.basename}`);
	}
}
