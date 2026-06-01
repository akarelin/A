const { Plugin, Notice, Modal, PluginSettingTab, Setting } = require("obsidian");
const { spawn } = require("child_process");
const path = require("path");

class SpeakerMappingModal extends Modal {
	constructor(app, speakers, suggestions, persons, onSubmit) {
		super(app);
		this.speakers = speakers;
		this.persons = persons;
		this.onSubmit = onSubmit;
		this.mappings = { ...suggestions };
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Speaker Mapping" });
		contentEl.createEl("p", {
			text: "Match detected speakers to KG persons. Select '— not in KG —' to skip linking.",
			cls: "setting-item-description",
		});

		const table = contentEl.createEl("table", { cls: "speaker-mapping-table" });
		const style = contentEl.createEl("style");
		style.textContent = `
			.speaker-mapping-table { width: 100%; border-collapse: collapse; margin: 1em 0; }
			.speaker-mapping-table th, .speaker-mapping-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--background-modifier-border); }
			.speaker-mapping-table th { font-weight: 600; }
			.speaker-mapping-table select { width: 100%; padding: 4px 8px; }
			.speaker-mapping-convert { margin-top: 1em; }
		`;

		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "Speaker" });
		headerRow.createEl("th", { text: "KG Person" });

		const tbody = table.createEl("tbody");

		for (const speaker of this.speakers) {
			const row = tbody.createEl("tr");
			row.createEl("td", { text: speaker });

			const selectCell = row.createEl("td");
			const select = selectCell.createEl("select");

			select.createEl("option", {
				text: "— not in KG —",
				value: "__none__",
			});

			for (const person of this.persons) {
				select.createEl("option", {
					text: person,
					value: person,
				});
			}

			if (this.mappings[speaker]) {
				select.value = this.mappings[speaker];
			} else {
				select.value = "__none__";
			}

			select.addEventListener("change", () => {
				this.mappings[speaker] = select.value === "__none__" ? null : select.value;
			});

			this.mappings[speaker] = select.value === "__none__" ? null : select.value;
		}

		const buttonContainer = contentEl.createDiv({ cls: "speaker-mapping-convert" });
		const btn = buttonContainer.createEl("button", {
			text: "Convert",
			cls: "mod-cta",
		});
		btn.addEventListener("click", () => {
			this.close();
			this.onSubmit(this.mappings);
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

const DEFAULT_SETTINGS = {
	openaiApiKey: "",
	model: "gpt-5.3",
	pythonPath: "python",
};

class VoiceTranscriptPlugin extends Plugin {
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new VoiceTranscriptSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (
					file.extension === "txt" &&
					file.path.startsWith("Communication/Meetings/")
				) {
					menu.addItem((item) => {
						item
							.setTitle("Convert voice transcript")
							.setIcon("mic")
							.onClick(() => this.convertTranscript(file));
					});
				}
			})
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getVaultPath() {
		return this.app.vault.adapter.basePath;
	}

	getScriptPath() {
		return path.join(this.getVaultPath(), "{internals}", "Scripts", "convert_transcript.py");
	}

	runPython(mode, inputData) {
		return new Promise((resolve, reject) => {
			const proc = spawn(this.settings.pythonPath, [this.getScriptPath(), `--${mode}`], {
				cwd: this.getVaultPath(),
				stdio: ["pipe", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";

			proc.stdout.on("data", (chunk) => { stdout += chunk; });
			proc.stderr.on("data", (chunk) => { stderr += chunk; });

			proc.on("error", (err) => {
				reject(new Error(`Failed to start Python: ${err.message}`));
			});

			proc.on("close", (code) => {
				if (code !== 0) {
					reject(new Error(stderr.trim() || `Python exited with code ${code}`));
				} else {
					resolve(stdout);
				}
			});

			proc.stdin.write(JSON.stringify(inputData));
			proc.stdin.end();
		});
	}

	async convertTranscript(file) {
		if (!this.settings.openaiApiKey) {
			new Notice("Voice Transcript Converter: Set your OpenAI API key in plugin settings");
			return;
		}

		const outputName = file.name
			.replace(/\s*\(RAW\)/i, "")
			.replace(/\.txt$/i, ".md");
		const outputPath = file.parent.path + "/" + outputName;

		const existing = this.app.vault.getAbstractFileByPath(outputPath);
		if (existing) {
			new Notice("Output file already exists: " + outputName);
			return;
		}

		const content = await this.app.vault.read(file);

		let extractResult;
		try {
			const raw = await this.runPython("extract", {
				content,
				vault_path: this.getVaultPath(),
			});
			extractResult = JSON.parse(raw);
		} catch (e) {
			console.error("Voice Transcript Converter extract error:", e);
			new Notice("Speaker extraction failed: " + e.message);
			return;
		}

		const { speakers, suggestions, persons, platforms, orgs } = extractResult;

		if (!speakers || speakers.length === 0) {
			new Notice("No speakers detected in transcript.");
			return;
		}

		new SpeakerMappingModal(
			this.app,
			speakers,
			suggestions,
			persons,
			(mappings) => this.runConversion(content, outputPath, outputName, mappings, platforms, orgs)
		).open();
	}

	async runConversion(content, outputPath, outputName, mappings, platforms, orgs) {
		new Notice("Converting transcript... this may take a minute.");

		try {
			const result = await this.runPython("convert", {
				content,
				mappings,
				platforms,
				orgs,
				model: this.settings.model,
				api_key: this.settings.openaiApiKey,
			});

			await this.app.vault.create(outputPath, result);
			new Notice("Transcript converted: " + outputName);

			const newFile = this.app.vault.getAbstractFileByPath(outputPath);
			if (newFile) {
				await this.app.workspace.getLeaf().openFile(newFile);
			}
		} catch (e) {
			console.error("Voice Transcript Converter error:", e);
			new Notice("Conversion failed: " + e.message);
		}
	}
}

class VoiceTranscriptSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Voice Transcript Converter" });

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("Your OpenAI API key")
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.openaiApiKey)
					.then((t) => { t.inputEl.type = "password"; })
					.onChange(async (value) => {
						this.plugin.settings.openaiApiKey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Model")
			.setDesc("OpenAI model to use")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Python Path")
			.setDesc("Path to Python executable")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.pythonPath)
					.onChange(async (value) => {
						this.plugin.settings.pythonPath = value;
						await this.plugin.saveSettings();
					})
			);
	}
}

module.exports = VoiceTranscriptPlugin;
