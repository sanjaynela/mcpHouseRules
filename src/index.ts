import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// IMPORTANT: stdio MCP servers must not write logs to stdout.
// stdout is reserved for protocol messages.
function log(...args: unknown[]) {
  process.stderr.write(args.map(String).join(" ") + "\n");
}

const server = new Server(
  { name: "mcp-house-rules", version: "0.1.0" },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

// 1) List prompts: lets clients discover what templates exist.
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "house_rules",
        description:
          "Reusable instructions for how I want the assistant to behave (safe, scoped, and consistent).",
        arguments: [
          {
            name: "mode",
            description:
              "Optional: what kind of work we are doing (review, triage, release-notes).",
            required: false,
          },
        ],
      },
    ],
  };
});

// 2) Get prompt: returns the actual prompt content.
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name !== "house_rules") {
    throw new Error(`Unknown prompt: ${request.params.name}`);
  }

  const mode =
    typeof request.params.arguments?.mode === "string"
      ? request.params.arguments.mode
      : "general";

  const text = [
    "You are my coding assistant.",
    "",
    "Operating rules:",
    "1) Prefer safe and reversible actions. Start read-only.",
    "2) Summarize what you plan to do before you do it.",
    "3) Keep scope small. If a task is large, propose the smallest next step.",
    "4) Be explicit. Use checklists and concrete commands.",
    "5) If you are blocked, ask one clarifying question. Otherwise proceed.",
    "",
    `Mode: ${mode}`,
    "",
    "When using tools:",
    "- Explain which tool you are calling and why.",
    "- If a tool can mutate data, confirm intent first.",
  ].join("\n");

  return {
    description: "My reusable assistant rules",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text }],
      },
    ],
  };
});

// 3) Tool: git_context - fetches compact git context
const GitContextSchema = z.object({
  repoPath: z.string().min(1).describe("Absolute path to a git repository"),
  maxCommits: z.number().int().min(1).max(50).default(15),
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "git_context",
        description:
          "Fetches a compact git context bundle so the assistant stops asking for basic repo details.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: { type: "string", description: "Absolute repo path" },
            maxCommits: {
              type: "number",
              description: "Max commits (1..50)",
              default: 15,
            },
          },
          required: ["repoPath"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "git_context") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const args = GitContextSchema.parse(request.params.arguments);

  // Quick guardrail: fail nicely if this isn't a repo.
  const isRepo = await execFileAsync("git", [
    "-C",
    args.repoPath,
    "rev-parse",
    "--is-inside-work-tree",
  ])
    .then((r) => r.stdout.trim() === "true")
    .catch(() => false);

  if (!isRepo) {
    return {
      content: [
        {
          type: "text",
          text: `Not a git repository: ${args.repoPath}`,
        },
      ],
    };
  }

  // Branch
  const branch = await execFileAsync("git", [
    "-C",
    args.repoPath,
    "rev-parse",
    "--abbrev-ref",
    "HEAD",
  ]).then((r) => r.stdout.trim());

  // Recent commits
  const commits = await execFileAsync("git", [
    "-C",
    args.repoPath,
    "log",
    "-n",
    String(args.maxCommits),
    "--pretty=format:%h %s",
  ]).then((r) => r.stdout.trim());

  // Diffstat vs latest commit (simple, fast)
  const diffstat = await execFileAsync("git", [
    "-C",
    args.repoPath,
    "show",
    "--stat",
    "--oneline",
    "-1",
  ]).then((r) => r.stdout.trim());

  const payload = [
    "# Repo Context",
    `- Branch: ${branch}`,
    "",
    "## Recent commits",
    commits ? commits.split("\n").map((l) => `- ${l}`).join("\n") : "- None",
    "",
    "## Latest commit diffstat",
    "```",
    diffstat,
    "```",
  ].join("\n");

  return {
    content: [{ type: "text", text: payload }],
  };
});

// Boot code for stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("mcp-house-rules running on stdio");
}

main().catch((err) => {
  log("Fatal error:", err);
  process.exit(1);
});
