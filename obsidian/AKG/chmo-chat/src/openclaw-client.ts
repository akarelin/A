export interface OpenClawConfig {
	gatewayUrl: string;
	token: string;
}

export interface SessionRow {
	key: string;
	label?: string;
	displayName?: string;
	derivedTitle?: string;
	lastMessagePreview?: string;
	updatedAt: number | null;
	status?: string;
	kind?: string;
	channel?: string;
}

export interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
	messageSeq?: number;
	timestamp?: number;
}

export interface HistoryMessage {
	role: string;
	content: string | { type: string; text?: string }[];
}

type FrameHandler = (frame: any) => void;

export class OpenClawClient {
	private ws: WebSocket | null = null;
	private config: OpenClawConfig;
	private reqId = 0;
	private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
	private eventHandlers = new Map<string, Set<FrameHandler>>();
	private connected = false;
	private subscribedSessions = new Set<string>();
	private tickInterval: ReturnType<typeof setInterval> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	onConnectionChange?: (connected: boolean) => void;

	constructor(config: OpenClawConfig) {
		this.config = config;
	}

	updateConfig(config: OpenClawConfig) {
		this.config = config;
	}

	isConnected(): boolean {
		return this.connected;
	}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.ws) {
				this.disconnect();
			}

			let url = this.config.gatewayUrl;
			// Normalize protocol
			if (url.startsWith("http://")) url = "ws://" + url.slice(7);
			else if (url.startsWith("https://")) url = "wss://" + url.slice(8);
			else if (!url.startsWith("ws://") && !url.startsWith("wss://")) url = "ws://" + url;

			console.log("[chmo] connecting to", url);
			this.ws = new WebSocket(url);

			let handshakeStarted = false;
			let connectReqId: string | null = null;

			this.ws.onopen = () => {
				console.log("[chmo] ws open, waiting for challenge");
			};

			this.ws.onmessage = (ev: MessageEvent) => {
				let frame: any;
				try {
					frame = JSON.parse(typeof ev.data === "string" ? ev.data : "");
				} catch {
					return;
				}
				console.log("[chmo] <<", frame.type, frame.event || frame.method || frame.id || "");

				// Handle connect.challenge -> send connect request
				if (frame.type === "event" && frame.event === "connect.challenge" && !handshakeStarted) {
					handshakeStarted = true;
					connectReqId = this.nextId();
					this.sendRaw({
						type: "req",
						id: connectReqId,
						method: "connect",
						params: {
							minProtocol: 3,
							maxProtocol: 3,
							client: {
								id: "openclaw-control-ui",
								displayName: "Obsidian",
								version: "0.1.0",
								platform: "macos",
								mode: "webchat",
							},
							role: "operator",
							scopes: ["operator.read", "operator.write"],
							caps: [],
							commands: [],
							permissions: {},
							auth: { token: this.config.token },
							locale: navigator.language || "en-US",
							userAgent: "chmo-obsidian/0.1.0",
						},
					});
					return;
				}

				// Handle connect response (match by request ID)
				if (frame.type === "res" && connectReqId && frame.id === connectReqId) {
					connectReqId = null;
					if (frame.ok) {
						this.connected = true;
						const tickMs = frame.payload?.policy?.tickIntervalMs || 15000;
						this.startTick(tickMs);
						this.onConnectionChange?.(true);
						console.log("[chmo] connected, protocol", frame.payload?.protocol);
						resolve();
					} else {
						const msg = frame.error?.message || "Connection rejected";
						console.error("[chmo] connect rejected:", frame.error);
						reject(new Error(msg));
					}
					return;
				}

				// Handle response frames
				if (frame.type === "res" && frame.id) {
					const p = this.pending.get(frame.id);
					if (p) {
						this.pending.delete(frame.id);
						if (frame.ok) {
							p.resolve(frame.payload);
						} else {
							p.reject(new Error(frame.error?.message || "Request failed"));
						}
					}
					return;
				}

				// Handle event frames
				if (frame.type === "event" && frame.event) {
					const handlers = this.eventHandlers.get(frame.event);
					if (handlers) {
						for (const h of handlers) {
							try { h(frame); } catch { /* ignore handler errors */ }
						}
					}
				}
			};

			this.ws.onerror = (err) => {
				console.error("[chmo] ws error:", err);
				if (!this.connected) {
					reject(new Error("WebSocket connection failed — check gateway URL in settings"));
				}
			};

			this.ws.onclose = () => {
				const wasConnected = this.connected;
				this.connected = false;
				this.stopTick();
				this.subscribedSessions.clear();
				// Reject all pending requests
				for (const [, p] of this.pending) {
					p.reject(new Error("Connection closed"));
				}
				this.pending.clear();
				if (wasConnected) {
					this.onConnectionChange?.(false);
					this.scheduleReconnect();
				}
			};
		});
	}

	disconnect() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.stopTick();
		this.subscribedSessions.clear();
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.close();
			this.ws = null;
		}
		this.connected = false;
		this.onConnectionChange?.(false);
	}

	private scheduleReconnect() {
		if (this.reconnectTimer) return;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect().catch(() => {
				// Will retry on next close
			});
		}, 5000);
	}

	private startTick(intervalMs: number) {
		this.stopTick();
		this.tickInterval = setInterval(() => {
			if (this.connected) {
				this.sendRaw({ type: "event", event: "tick", payload: {} });
			}
		}, intervalMs);
	}

	private stopTick() {
		if (this.tickInterval) {
			clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
	}

	on(event: string, handler: FrameHandler) {
		let set = this.eventHandlers.get(event);
		if (!set) {
			set = new Set();
			this.eventHandlers.set(event, set);
		}
		set.add(handler);
	}

	off(event: string, handler: FrameHandler) {
		const set = this.eventHandlers.get(event);
		if (set) {
			set.delete(handler);
		}
	}

	private nextId(): string {
		return `obs-${++this.reqId}`;
	}

	private sendRaw(data: any) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data));
		}
	}

	request(method: string, params: any = {}): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!this.connected) {
				reject(new Error("Not connected"));
				return;
			}
			const id = this.nextId();
			this.pending.set(id, { resolve, reject });
			this.sendRaw({ type: "req", id, method, params });
			// Timeout after 30s
			setTimeout(() => {
				if (this.pending.has(id)) {
					this.pending.delete(id);
					reject(new Error("Request timeout"));
				}
			}, 30000);
		});
	}

	async listSessions(opts?: { limit?: number; includeDerivedTitles?: boolean }): Promise<{ sessions: SessionRow[] }> {
		const result = await this.request("sessions.list", {
			limit: opts?.limit ?? 50,
			includeDerivedTitles: opts?.includeDerivedTitles ?? true,
			includeLastMessage: true,
		});
		return result;
	}

	async createSession(opts?: { label?: string; agentId?: string; message?: string }): Promise<{ key: string }> {
		const result = await this.request("sessions.create", {
			label: opts?.label,
			agentId: opts?.agentId,
			message: opts?.message,
		});
		return result;
	}

	async subscribeSession(sessionKey: string) {
		if (this.subscribedSessions.has(sessionKey)) return;
		await this.request("sessions.messages.subscribe", { key: sessionKey });
		this.subscribedSessions.add(sessionKey);
	}

	async unsubscribeSession(sessionKey: string) {
		if (!this.subscribedSessions.has(sessionKey)) return;
		await this.request("sessions.messages.unsubscribe", { key: sessionKey }).catch(() => {});
		this.subscribedSessions.delete(sessionKey);
	}

	async sendMessage(sessionKey: string, message: string): Promise<any> {
		const idempotencyKey = `obs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		return this.request("sessions.send", {
			key: sessionKey,
			message,
			idempotencyKey,
		});
	}

	async abortSession(sessionKey: string): Promise<void> {
		await this.request("sessions.abort", { key: sessionKey }).catch(() => {});
	}

	async getHistory(sessionKey: string, limit = 100): Promise<{ messages: HistoryMessage[] }> {
		return this.request("chat.history", {
			sessionKey,
			limit,
			maxChars: 500000,
		});
	}
}
