# Mandatory Runtime & Package Manager Rules

## 1. Strict Package Manager Lock (BUN ONLY)
- **NEVER execute `npx`, `npm`, `pnpm`, or `yarn`.**
- ALWAYS substitute package runner and management commands with `bun`:
  - Replace `npx <package>` $\rightarrow$ `bunx <package>` or `bun x <package>`
  - Replace `npm run <script>` / `pnpm run` $\rightarrow$ `bun run <script>`
  - Replace `npm install` / `pnpm add` $\rightarrow$ `bun add`
  - Replace `npm install -D` $\rightarrow$ `bun add -d`
- If a tool or script attempts to invoke `npx`, override the command line invocation to use `bunx`.

## 2. Task Execution & Subagent Behavior
- **Do NOT delegate tasks to background subagents, child agents, or separate explorer threads.**
- Execute ALL file analysis, schema checks, server action edits, and UI updates directly in this primary main thread.
- Work synchronously and sequentially until the requested feature is 100% complete.
- Do not stop halfway through execution to ask for confirmation or report intermediate findings—finish implementation in full before ending your turn.

## 3. Commit Discipline
- After a new feature is complete (verified with `bunx tsc --noEmit` + `bunx next build`) **and the user has approved it**, commit that feature before starting the next one — do not let multiple finished features pile up uncommitted.
- Approval means an explicit sign-off from the user (e.g. "looks good", "works", or a request to move on to unrelated work). If approval is ambiguous, ask before committing.
- Scope each commit to one feature arc; never bundle unrelated features into a single commit.
- Follow the repo's commit style: lowercase conventional prefixes (`feat:` / `fix:` / `refactor:`) with a descriptive summary.
- Never commit `.env.development.local`.

## 4. Technical Context
- Full-stack Next.js application using Drizzle ORM, PostgreSQL, SWR, Pusher, and Sonner toasts.
- When refactoring data models, ensure strict atomic typing rather than combined display strings.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
