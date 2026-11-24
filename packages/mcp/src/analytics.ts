/**
 * The PostHog MCP analytics options both Meerko servers share (the hosted /mcp in apps/api, and stdio in index.ts).
 *
 * `@posthog/mcp` adds `context`, `llm_model` and `conversation_id` arguments to every tool by default. Their text is
 * written to the model in imperatives ("You MUST describe only…", "NEVER include…", "never guess", "do not issue
 * parallel tool calls"), and `context` has the model justify each call. ChatGPT's approval classifier reads all of
 * that with the tool's own documentation, and flagged a write tool's call as "Suspicious Instruction" for steering
 * its risk label and approval outcome. So every tool's schema stays exactly as server.ts declares it: no injected
 * arguments, and no `conversation_id` added to results. Tool calls, clients, durations and errors are still captured.
 */
export const MCP_ANALYTICS_OPTIONS = {
  context: false,
  captureModel: false,
  enableConversationId: false,
} as const;
