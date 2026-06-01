import { spawn, type ChildProcess } from "child_process";

export interface ClaudeEvent {
	type: string;
	subtype?: string;
	session_id?: string;
	message?: {
		role: string;
		content: any[];
		model?: string;
		usage?: any;
	};
	result?: string;
	total_cost_usd?: number;
	duration_ms?: number;
	rate_limit_info?: {
		status: string;
		utilization: number;
		resetsAt: number;
	};
	tools?: string[];
	model?: string;
	is_error?: boolean;
	[key: string]: any;
}

export interface ClaudeRunOpts {
	cwd: string;
	sessionId?: string;
	agent?: string;
	model?: string;
	name?: string;
	maxBudget?: number;
	permissionMode?: string;
	allowedTools?: string[];
	timeout?: number;
	onEvent: (event: ClaudeEvent) => void;
	onDone: (result: ClaudeEvent | null) => void;
}

export function runClaude(prompt: string, opts: ClaudeRunOpts): ChildProcess {
	const args = ["-p", "--output-format", "stream-json", "--verbose"];

	if (opts.sessionId) {
		args.push("--resume", opts.sessionId);
	}
	if (opts.agent) {
		args.push("--agent", opts.agent);
	}
	if (opts.model) {
		args.push("--model", opts.model);
	}
	if (opts.name) {
		args.push("--name", opts.name);
	}
	if (opts.maxBudget) {
		args.push("--max-budget-usd", String(opts.maxBudget));
	}
	if (opts.permissionMode) {
		args.push("--permission-mode", opts.permissionMode);
	}
	if (opts.allowedTools && opts.allowedTools.length > 0) {
		args.push("--allowedTools", ...opts.allowedTools);
	}

	args.push(prompt);

	const proc = spawn("claude", args, {
		cwd: opts.cwd,
		env: { ...process.env, TERM: "dumb" },
		shell: true,
	});

	let buffer = "";
	let lastResult: ClaudeEvent | null = null;

	const timer = opts.timeout
		? setTimeout(() => {
				proc.kill("SIGTERM");
			}, opts.timeout)
		: null;

	proc.stdout?.on("data", (chunk: Buffer) => {
		buffer += chunk.toString();
		const lines = buffer.split("\n");
		buffer = lines.pop() || ""; // keep incomplete last line in buffer

		for (const line of lines) {
			if (!line.trim()) continue;
			try {
				const event: ClaudeEvent = JSON.parse(line);
				if (event.type === "result") {
					lastResult = event;
				}
				opts.onEvent(event);
			} catch {
				// non-JSON output, ignore
			}
		}
	});

	proc.stderr?.on("data", (chunk: Buffer) => {
		console.warn("[claude-local]", chunk.toString());
	});

	proc.on("close", () => {
		if (timer) clearTimeout(timer);
		// flush remaining buffer
		if (buffer.trim()) {
			try {
				const event: ClaudeEvent = JSON.parse(buffer);
				if (event.type === "result") lastResult = event;
				opts.onEvent(event);
			} catch { /* ignore */ }
		}
		opts.onDone(lastResult);
	});

	proc.on("error", (err) => {
		if (timer) clearTimeout(timer);
		opts.onEvent({
			type: "result",
			subtype: "error",
			is_error: true,
			result: err.message,
		});
		opts.onDone(null);
	});

	return proc;
}

/** Extract readable text from assistant message content blocks */
export function extractText(content: any[]): string {
	if (!Array.isArray(content)) return "";
	return content
		.filter((b) => b.type === "text" && b.text)
		.map((b) => b.text)
		.join("\n");
}

/** Extract tool use blocks from assistant message content */
export function extractToolUse(content: any[]): { name: string; input: any; id?: string }[] {
	if (!Array.isArray(content)) return [];
	return content
		.filter((b) => b.type === "tool_use")
		.map((b) => ({ name: b.name, input: b.input, id: b.id }));
}

/** Format a tool use block for display */
export function formatToolUse(tool: { name: string; input: any }): { label: string; detail: string } {
	const name = tool.name;
	const input = tool.input || {};

	switch (name) {
		case "Read":
			return { label: `Read ${input.file_path || "file"}`, detail: "" };
		case "Edit":
			return {
				label: `Edit ${input.file_path || "file"}`,
				detail: input.old_string && input.new_string
					? `- ${input.old_string.slice(0, 80)}\n+ ${input.new_string.slice(0, 80)}`
					: "",
			};
		case "Write":
			return { label: `Write ${input.file_path || "file"}`, detail: "" };
		case "Bash":
			return { label: `Run command`, detail: input.command || "" };
		case "Glob":
			return { label: `Search files: ${input.pattern || ""}`, detail: "" };
		case "Grep":
			return { label: `Search: ${input.pattern || ""}`, detail: input.path || "" };
		case "WebSearch":
			return { label: `Web search: ${input.query || ""}`, detail: "" };
		case "WebFetch":
			return { label: `Fetch: ${input.url || ""}`, detail: "" };
		default:
			return { label: name, detail: JSON.stringify(input).slice(0, 120) };
	}
}
