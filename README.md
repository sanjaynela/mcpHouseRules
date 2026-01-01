# MCP House Rules Server

Stop re-explaining yourself to AI assistants. This MCP (Model Context Protocol) server exposes reusable "house rules" as prompts and provides automatic git context, so you can focus on what you actually want to do instead of repeating the same setup instructions.

## What Problem Does This Solve?

If you use AI assistants daily, you've probably experienced this loop:
1. You open Cursor or VS Code and ask it to review a PR
2. It asks where the repo is, what branch, what you want checked
3. You paste the same context you pasted yesterday
4. You switch to another client and do it again

This project solves two problems:
- **Prompt reuse**: Your "house rules" for how you want the assistant to behave are published once and discoverable by any MCP client
- **Context reuse**: Basic git information (branch, recent commits, diffstat) is fetched automatically so the assistant stops asking basic questions

## What This Project Provides

### 1. House Rules Prompt

A reusable prompt template named `house_rules` that defines your preferred assistant behavior:
- Prefer safe and reversible actions (start read-only)
- Summarize before acting
- Keep scope small
- Be explicit with checklists
- Ask one clarifying question only when truly blocked

The prompt accepts an optional `mode` parameter (e.g., "review", "triage", "release-notes") to adapt the behavior for different workflows.

### 2. Git Context Tool

A tool named `git_context` that automatically fetches:
- Current branch name
- Recent commit history (configurable, default 15 commits)
- Latest commit diffstat

This eliminates the back-and-forth of "which repo?", "which branch?", "what changed?"

## Project Structure

```
mcp-house-rules/
├── src/
│   └── index.ts          # Main MCP server implementation
├── dist/                 # Compiled JavaScript (generated)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## Components Explained

### MCP Server (`src/index.ts`)

The server implements three main handlers:

1. **ListPromptsHandler**: Exposes the `house_rules` prompt so clients can discover it
2. **GetPromptHandler**: Returns the actual prompt content with optional mode customization
3. **ListToolsHandler**: Exposes the `git_context` tool
4. **CallToolHandler**: Executes `git_context` by running git commands and returning formatted results

### Key Features

- **Stdio Transport**: Uses standard input/output for communication (required for MCP)
- **Error Handling**: Validates git repository before attempting operations
- **Logging**: All logs go to stderr (stdout is reserved for protocol messages)
- **Type Safety**: Uses Zod for runtime validation of tool arguments

## Installation

1. Clone or download this repository
2. Install dependencies:

```bash
npm install
```

3. Build the TypeScript code:

```bash
npm run build
```

4. Test the server:

```bash
npm start
```

You should see a log message on stderr indicating the server is running.

## Testing with MCP Inspector

Before wiring this into your AI client, test it with the MCP Inspector:

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

This will help you verify:
- ✅ Prompts list includes `house_rules`
- ✅ Tools list includes `git_context`
- ✅ Calling `house_rules` returns your operating rules
- ✅ Calling `git_context` returns a compact repo context bundle

## Integration with MCP Clients

Different MCP clients have different configuration formats, but the setup is similar:

1. Register the server as a local process
2. Set the command to: `node` + absolute path to `dist/index.js`
3. The client will discover prompts and tools automatically

### Example Configuration (Cursor)

In your Cursor MCP settings, add:

```json
{
  "mcpServers": {
    "house-rules": {
      "command": "node",
      "args": ["/absolute/path/to/mcpHouseRules/dist/index.js"]
    }
  }
}
```

## Daily Usage Example

Once integrated, your workflow becomes:

1. **Apply the house_rules prompt** (with optional mode):
   ```
   Apply house_rules in review mode
   ```

2. **Call git_context** for your repository:
   ```
   Call git_context on /absolute/path/to/repo with 15 commits
   ```

3. **Ask for what you actually want**:
   ```
   Summarize what changed recently, flag risky areas, and give me a short checklist for what to verify before merging.
   ```

**What changed compared to normal prompting:**
- ✅ You're not retyping rules every time
- ✅ You're not answering "what branch is this"
- ✅ The assistant starts from a compact, consistent context bundle

## Common Pitfalls

### 1. Logging to stdout breaks everything

**Don't use `console.log` in a stdio MCP server.** stdout is reserved for protocol messages. Always log to stderr using the provided `log()` function.

### 2. Use absolute paths

If you pass a relative path for `repoPath`, different clients may run your server with different working directories. Always use absolute paths to avoid weird failures.

### 3. Resist the urge to overbuild

It's tempting to add features like:
- "Summarize PR"
- "Open files"
- "Edit code"
- "Commit changes"

**Resist it.** This server is valuable because it stays focused:
- Publish reusable behavior (prompt)
- Publish reusable context (tool)

Everything else can remain in the AI client.

## Customization

### Modifying House Rules

Edit the prompt text in `src/index.ts` within the `GetPromptRequestSchema` handler. The rules are defined in the `text` array.

### Adding New Modes

The `mode` parameter is already supported. You can extend the prompt logic to provide different instructions based on the mode:

```typescript
const modeInstructions = {
  review: "Focus on code quality, potential bugs, and maintainability.",
  triage: "Prioritize issues by severity and impact.",
  "release-notes": "Generate concise, user-facing release notes.",
};

const text = [
  // ... existing rules ...
  modeInstructions[mode] || "",
].join("\n");
```

### Extending Git Context

You can add more git information to the `git_context` tool by adding additional `execFileAsync` calls:

```typescript
// Example: Get file changes
const fileChanges = await execFileAsync("git", [
  "-C",
  args.repoPath,
  "diff",
  "--name-status",
  "HEAD~1",
]).then((r) => r.stdout.trim());
```

## Development

### Build

```bash
npm run build
```

### Run

```bash
npm start
```

### TypeScript Configuration

The project uses strict TypeScript settings. See `tsconfig.json` for details.

## License

MIT

## Credits

This project is based on the article: "Stop Re-Explaining Yourself to AI with MCP" - a beginner-friendly guide to building reusable MCP servers.

## Contributing

This is a minimal, focused server. If you want to extend it, consider:
1. Keeping it simple and focused
2. Adding only reusable prompts and context tools
3. Avoiding complex agent logic (that belongs in the client)

---

**Remember**: Tools are reusable actions. Prompts are reusable behavior. Together, they turn "I keep re-explaining myself" into "my client can discover how I work."
