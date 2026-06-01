import type { OpenClawClient } from "./openclaw-client";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface AgentInfo {
	id: string;
	name: string;
	model: string;
	workspace: string;
	skills: string[];
	skillCount: number;
	subagents: string[];
	isDefault: boolean;
	isSubagent: boolean;
}

export interface CronJobInfo {
	id: string;
	name: string;
	enabled: boolean;
	schedule: string;
	agentId: string;
	lastRunAt: number | null;
	lastRunStatus: string | null;
	lastDurationMs: number | null;
	consecutiveErrors: number;
	lastDeliveryStatus: string | null;
}

const REFRESH_INTERVAL = 30_000;

export class DashboardAPI {
	private _config: any = null;
	private _configTs = 0;
	private _channelHealth: any = null;
	private _cronJobs: CronJobInfo[] = [];
	private _agents: AgentInfo[] = [];
	private _defaultModel = "";
	private _refreshTimer: ReturnType<typeof setInterval> | null = null;

	constructor(private client: OpenClawClient) {}

	start() {
		this.refresh();
		this._refreshTimer = setInterval(() => this.refresh(), REFRESH_INTERVAL);
	}

	stop() {
		if (this._refreshTimer) {
			clearInterval(this._refreshTimer);
			this._refreshTimer = null;
		}
	}

	private async refresh() {
		if (!this.client.isConnected()) return;

		// Fetch config (agents, channels, cron settings)
		try {
			this._config = await this.client.request("config.get", {});
			this._configTs = Date.now();
			this.parseAgents();
		} catch { /* gateway unavailable */ }

		// Fetch channel health
		try {
			this._channelHealth = await this.client.request("channels.status", {});
		} catch {
			this._channelHealth = null;
		}

		// Fetch cron jobs — try gateway API first, fall back to local file
		try {
			const result = await this.client.request("cron.list", {});
			this.parseCronJobs(result?.jobs || []);
		} catch {
			// Gateway API doesn't exist — read jobs.json directly
			try {
				const jobsPath = join(homedir(), ".openclaw", "cron", "jobs.json");
				const raw = JSON.parse(readFileSync(jobsPath, "utf8"));
				this.parseCronJobs(raw.jobs || []);
			} catch {
				// Not on host or file doesn't exist
				this._cronJobs = [];
			}
		}
	}

	private parseAgents() {
		const config = this._config;
		if (!config?.agents) return;

		this._defaultModel = config.agents.defaults?.model?.primary || "unknown";
		const list: any[] = config.agents.list || [];

		// Collect subagent IDs
		const subIds = new Set<string>();
		for (const a of list) {
			for (const sid of (a.subagents?.allowAgents || [])) {
				subIds.add(sid);
			}
		}

		this._agents = list.map((a) => ({
			id: a.id,
			name: a.name || a.id,
			model: this.resolveModel(a),
			workspace: a.workspace || "",
			skills: Array.isArray(a.skills) ? a.skills : [],
			skillCount: Array.isArray(a.skills) ? a.skills.length : 0,
			subagents: a.subagents?.allowAgents || [],
			isDefault: !!a.default,
			isSubagent: subIds.has(a.id),
		}));
	}

	private resolveModel(agent: any): string {
		if (!agent.model) return this._defaultModel;
		if (typeof agent.model === "string") return agent.model;
		return agent.model.primary || this._defaultModel;
	}

	private parseCronJobs(jobs: any[]) {
		this._cronJobs = jobs.map((j: any) => ({
			id: j.id || "",
			name: j.name || "Unnamed",
			enabled: !!j.enabled,
			schedule: j.schedule?.expr || "?",
			agentId: j.agentId || "",
			lastRunAt: j.state?.lastRunAtMs ?? null,
			lastRunStatus: j.state?.lastRunStatus ?? null,
			lastDurationMs: j.state?.lastDurationMs ?? null,
			consecutiveErrors: j.state?.consecutiveErrors ?? 0,
			lastDeliveryStatus: j.state?.lastDeliveryStatus ?? null,
		}));
	}

	// ── Synchronous getters for DataviewJS ──

	get connected(): boolean {
		return this.client.isConnected();
	}

	get stale(): boolean {
		return !this._configTs || Date.now() - this._configTs > REFRESH_INTERVAL * 2;
	}

	get config(): any {
		return this._config;
	}

	get defaultModel(): string {
		return this._defaultModel;
	}

	get agents(): AgentInfo[] {
		return this._agents;
	}

	get primaryAgents(): AgentInfo[] {
		return this._agents.filter((a) => !a.isSubagent);
	}

	get subagentList(): AgentInfo[] {
		return this._agents.filter((a) => a.isSubagent);
	}

	get cronJobs(): CronJobInfo[] {
		return this._cronJobs;
	}

	get cronActive(): number {
		return this._cronJobs.filter((j) => j.enabled).length;
	}

	get cronTotal(): number {
		return this._cronJobs.length;
	}

	get channelHealth(): any {
		return this._channelHealth;
	}
}
