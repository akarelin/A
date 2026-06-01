import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ChmoPlugin from "./main";

export interface LocalSession {
	id: string;
	claudeSessionId: string;
	name: string;
	createdAt: number;
}

export interface ChmoSettings {
	gatewayUrl: string;
	token: string;
	defaultAgent: string;
	autoConnect: boolean;
	// Claude Local settings
	claudePermissionMode: string;
	claudeModel: string;
	claudeMaxBudget: number;
	localSessions: LocalSession[];
}

export const DEFAULT_SETTINGS: ChmoSettings = {
	gatewayUrl: "ws://localhost:18789",
	token: "",
	defaultAgent: "",
	autoConnect: true,
	claudePermissionMode: "default",
	claudeModel: "",
	claudeMaxBudget: 5,
	localSessions: [],
};

export class ChmoSettingTab extends PluginSettingTab {
	plugin: ChmoPlugin;

	constructor(app: App, plugin: ChmoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Gateway URL")
			.setDesc("WebSocket URL of your OpenClaw gateway (e.g. ws://localhost:18789)")
			.addText((text) =>
				text
					.setPlaceholder("ws://localhost:18789")
					.setValue(this.plugin.settings.gatewayUrl)
					.onChange(async (value) => {
						this.plugin.settings.gatewayUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auth token")
			.setDesc("Gateway authentication token")
			.addText((text) => {
				text
					.setPlaceholder("Enter token")
					.setValue(this.plugin.settings.token)
					.onChange(async (value) => {
						this.plugin.settings.token = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("Default agent")
			.setDesc("Agent ID for new sessions (leave empty for default)")
			.addText((text) =>
				text
					.setPlaceholder("alex")
					.setValue(this.plugin.settings.defaultAgent)
					.onChange(async (value) => {
						this.plugin.settings.defaultAgent = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-connect")
			.setDesc("Automatically connect to the gateway when Obsidian starts")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoConnect).onChange(async (value) => {
					this.plugin.settings.autoConnect = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Reconnect")
			.setDesc("Disconnect and reconnect to the gateway")
			.addButton((btn) =>
				btn.setButtonText("Reconnect").onClick(async () => {
					this.plugin.client.disconnect();
					this.plugin.client.updateConfig({
						gatewayUrl: this.plugin.settings.gatewayUrl,
						token: this.plugin.settings.token,
					});
					try {
						await this.plugin.client.connect();
						new Notice("Connected to Chmo gateway");
					} catch (e: any) {
						new Notice(`Connection failed: ${e.message}`);
					}
				})
			);

		// ── Claude Local Settings ──

		containerEl.createEl("h3", { text: "Claude Code (Local)" });

		new Setting(containerEl)
			.setName("Permission mode")
			.setDesc("How Claude handles tool permissions in local mode")
			.addDropdown((drop) =>
				drop
					.addOptions({
						default: "Default (ask)",
						acceptEdits: "Accept edits",
						plan: "Plan only",
						bypassPermissions: "Bypass all (unsafe)",
					})
					.setValue(this.plugin.settings.claudePermissionMode)
					.onChange(async (value) => {
						this.plugin.settings.claudePermissionMode = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Default model for local Claude sessions (leave empty for default)")
			.addText((text) =>
				text
					.setPlaceholder("sonnet")
					.setValue(this.plugin.settings.claudeModel)
					.onChange(async (value) => {
						this.plugin.settings.claudeModel = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Max budget (USD)")
			.setDesc("Maximum spend per local Claude invocation")
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.claudeMaxBudget))
					.onChange(async (value) => {
						const n = parseFloat(value);
						if (!isNaN(n) && n > 0) {
							this.plugin.settings.claudeMaxBudget = n;
							await this.plugin.saveSettings();
						}
					})
			);
	}
}
