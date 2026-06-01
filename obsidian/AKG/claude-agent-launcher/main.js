const { Plugin, Notice, Modal, Setting } = require("obsidian");
const { exec } = require("child_process");
const path = require("path");

const CLAUDE_PATH = "claude";
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp", "pdf"]);

// Agent definitions: id -> { label, buildCmd(absPath, vaultPath) }
const AGENTS = {
  "medical-scan-obsidian": {
    label: "Medical Scan \u2192 Obsidian Notes",
    fileMode: "both",
    buildPrompt(absPath, isFolder) {
      // If triggered on a file, use its parent folder as the scan source
      const scanDir = isFolder ? absPath : path.dirname(absPath);
      return `Process medical scans from: ${scanDir}`;
    },
    flags: "--agent medical-scan-obsidian --max-budget-usd 10",
  },
  ask: {
    label: "Ask Claude about this file",
    fileMode: "file",
    buildPrompt(absPath) {
      return null; // will prompt user
    },
    flags: "--max-budget-usd 2",
  },
};

class ClaudeAgentModal extends Modal {
  constructor(app, agents, onChoose) {
    super(app);
    this.agents = agents;
    this.onChoose = onChoose;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Claude Agent" });

    for (const [id, agent] of Object.entries(this.agents)) {
      new Setting(contentEl)
        .setName(agent.label)
        .addButton((btn) =>
          btn.setButtonText("Run").setCta().onClick(() => {
            this.close();
            this.onChoose(id);
          })
        );
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

class PromptModal extends Modal {
  constructor(app, title, onSubmit) {
    super(app);
    this.title = title;
    this.onSubmit = onSubmit;
    this.value = "";
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.title });

    const input = contentEl.createEl("textarea", {
      attr: {
        rows: 4,
        style: "width:100%;font-family:inherit;font-size:14px;padding:8px;",
        placeholder: "Enter your prompt...",
      },
    });
    input.addEventListener("input", (e) => {
      this.value = e.target.value;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        this.close();
        this.onSubmit(this.value);
      }
    });

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Run (Ctrl+Enter)")
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit(this.value);
        })
    );

    setTimeout(() => input.focus(), 50);
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = class ClaudeAgentLauncher extends Plugin {
  async onload() {
    // File context menu (right-click on file)
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        const ext = file.extension ? file.extension.toLowerCase() : "";
        const isImage = IMAGE_EXTS.has(ext);
        const isFolder = !file.extension && file.children !== undefined;

        if (isImage || isFolder) {
          menu.addItem((item) => {
            item
              .setTitle("Run Claude Agent")
              .setIcon("bot")
              .onClick(() => this.showAgentPicker(file, isFolder));
          });
        }
      })
    );

    // Command palette entry
    this.addCommand({
      id: "run-claude-agent",
      name: "Run Claude Agent on active file",
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice("No active file");
          return;
        }
        const ext = file.extension ? file.extension.toLowerCase() : "";
        this.showAgentPicker(file, false);
      },
    });
  }

  showAgentPicker(file, isFolder) {
    // Filter agents by mode
    const applicable = {};
    for (const [id, agent] of Object.entries(AGENTS)) {
      if (agent.fileMode === "both") applicable[id] = agent;
      else if (isFolder && agent.fileMode === "folder") applicable[id] = agent;
      else if (!isFolder && agent.fileMode === "file") applicable[id] = agent;
    }

    if (Object.keys(applicable).length === 1) {
      const id = Object.keys(applicable)[0];
      this.runAgent(id, file, isFolder);
    } else {
      new ClaudeAgentModal(this.app, applicable, (id) =>
        this.runAgent(id, file, isFolder)
      ).open();
    }
  }

  runAgent(agentId, file, isFolder) {
    const agent = AGENTS[agentId];
    const vaultPath = this.app.vault.adapter.basePath;
    const absPath = path.join(vaultPath, file.path).replace(/\\/g, "/");

    const prompt = agent.buildPrompt(absPath, isFolder);
    if (prompt === null) {
      // Need user prompt
      new PromptModal(this.app, `Ask Claude about: ${file.name}`, (userPrompt) => {
        if (!userPrompt) return;
        const fullPrompt = `File: ${absPath}\n\n${userPrompt}`;
        this.execClaude(agent.flags, fullPrompt, vaultPath);
      }).open();
    } else {
      this.execClaude(agent.flags, prompt, vaultPath);
    }
  }

  execClaude(flags, prompt, cwd) {
    const escaped = prompt.replace(/'/g, "'\\''");
    const cmd = `${CLAUDE_PATH} -p ${flags} '${escaped}'`;

    const notice = new Notice("Claude agent running...", 0);

    exec(cmd, { cwd, timeout: 300000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      notice.hide();
      if (err) {
        new Notice(`Claude error: ${err.message}`, 10000);
        console.error("Claude agent error:", err, stderr);
        return;
      }
      new Notice("Claude agent finished!", 5000);
      console.log("Claude agent output:", stdout);

      // Refresh vault to pick up new/changed files
      this.app.vault.adapter.reconcileInternalFile?.("") ||
        setTimeout(() => {
          // Force vault to rescan
          this.app.vault.trigger("raw", "");
        }, 1000);
    });
  }
};
