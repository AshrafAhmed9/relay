# Relay

A dispatch console your agent can fully operate. Which means someone who can't use a mouse can operate it too.

Built for the [OpenAI WebMCP Challenge](https://webmcp.devpost.com/). Relay is a logistics-dispatch operations console: jobs, drivers, vehicles, time windows, and the double-bookings and coverage gaps that come with all of that. Its core claim is **enforced parity**: every action available in the UI has a matching WebMCP tool with identical authority, and the reverse holds too. No tool exists that the UI can't also trigger.

**Live:** [relay-webmcp.ashrafahmed1232.workers.dev](https://relay-webmcp.ashrafahmed1232.workers.dev)

```js
document.modelContext.registerTool({
  name: "reschedule_assignment",
  description: "Change a job's time window.",
  inputSchema: {
    type: "object",
    properties: {
      jobId: { type: "string" },
      windowStart: { type: "number", description: "Absolute Unix timestamp in milliseconds." },
      windowEnd: { type: "number", description: "Absolute Unix timestamp in milliseconds, after windowStart." },
    },
    required: ["jobId", "windowStart", "windowEnd"],
  },
  execute: async (input) => ({ content: [{ type: "text", text: JSON.stringify(rescheduleJob(input)) }] }),
});
```
*(Simplified. The real registration goes through [`webmcp-kit`](https://github.com/AshrafAhmed9/webmcp-kit)'s `defineTool`/`registerTools`. See `src/tools/write.ts`.)*

## The mechanic

`scripts/check-tool-parity.ts` asserts that Relay's mutating WebMCP tools (`src/shared/tool-scopes.ts`, minus the read-only ones) and its UI's mutating actions (`src/shared/ui-actions.ts`) are the exact same set, not a superset in either direction. It runs as the first step of `npm run build`, so this isn't a claim sitting in a README. It's a build-time gate. Add a button without a matching tool, or a tool without a matching control, and the build fails.

```bash
npm run test:parity
# Tool/UI parity OK — 8 mutating tools, all paired with a UI action.
```

## Try it

Open the deployed URL in ChatGPT's in-app browser (or Chrome with `chrome://flags/#enable-webmcp-testing`) and ask your agent to close the coverage gaps, resolve the scheduling conflict, or preview a bulk reassignment before committing to it. In any other browser, the sidebar's **Simulated Agent** panel runs the same scripts through the same `tool.call()` functions.

The seed schedule ships with a real conflict (two jobs double-booked onto the same driver, overlapping by an hour) and a real coverage gap (a hazmat job with only one qualified driver, who's marked unavailable), so `list_conflicts` and `find_coverage_gaps` have genuine problems to find, not an empty result.

## Why this is a strong fit for WebMCP

Enforced parity is the sharpest version of what WebMCP is actually for. A server-side MCP server bolted onto this app's API could expose a `reassignJob` endpoint, but nothing would guarantee it stays in sync with what the UI can do, or that every UI capability is equally available to an agent. Normally that guarantee has to be maintained by hand, forever, or it silently rots. Here it's a single build step. And because the tool surface is exactly the UI's surface, this becomes a genuine accessibility story, not just a developer-experience one. `simulate_change`, `assign`, `reschedule_assignment`, and every other capability are drivable by voice or by an agent with no visual interaction at all, because there is no capability that exists only behind a mouse.

## How it improves the experience

Dense operational UIs (dispatch boards, scheduling grids, conflict resolvers) are exactly where accessibility tends to fail hardest, because so much of the interaction is spatial: drag, hover, click a small target. An agent operating through named tools sidesteps that entirely. "Reassign the two conflicting cold-chain jobs to different drivers" is a request a screen-reader user or a voice-only user can make today, on this app, with full authority. Not a scaled-down version of what a mouse user can do.

## Tools

19 tools, exactly matching the UI's mutating actions per `check-tool-parity.ts`.

| Tool | Kind | What it does |
|---|---|---|
| `get_schedule` | read | All jobs, with assignment status and time windows |
| `list_conflicts` | read | Drivers double-booked across overlapping windows |
| `find_coverage_gaps` | read | Jobs with no driver, distinguishing "unassigned" from "no qualified driver available" |
| `list_assignments` | read | All currently assigned jobs |
| `list_jobs` / `list_drivers` / `list_vehicles` | read | Filtered listings |
| `get_resource` | read | One driver or vehicle by id |
| `describe_view` | read | What the human currently has filtered or selected |
| `optimize_schedule` | read | Proposed assignments to close coverage gaps (proposals only, doesn't apply them) |
| `simulate_change` | read | Dry-run any mutation and return the diff, without applying it |
| `create_job` | write | Create a delivery job |
| `assign` | write | Assign driver + vehicle; refuses on a skill mismatch |
| `unassign` | write | Clear a job's assignment |
| `reschedule_assignment` | write | Change a job's time window |
| `swap_assignments` | write | Swap driver/vehicle between two jobs |
| `set_availability` | write | Mark a driver available or unavailable |
| `set_status` | write | Mark a job in-transit, completed, or cancelled |
| `bulk_reassign` | write, confirmation-gated | Reassign many jobs to one driver/vehicle |

## Architecture

- **`src/shared/reducer.ts`**: the one mutation path (assign, reschedule, swap, bulk reassign), including a real `SkillMismatchError` when a driver lacks a job's required skill.
- **`src/shared/derive.ts`**: `listConflicts` (overlapping time windows on one driver) and `findCoverageGaps`. Real derived computations, not placeholders.
- **`src/tools/higher-order.ts`**: `simulate_change`, a genuine dry-run. It calls the shared reducer and discards the result, returning only the diff.
- **`src/shared/ui-actions.ts`** plus **`scripts/check-tool-parity.ts`**: the parity contract and its enforcement.
- **`src/worker/`**: Cloudflare Worker + Durable Object, same pattern as [Cadence](https://github.com/AshrafAhmed9/cadence) and [Consequence](https://github.com/AshrafAhmed9/consequence).

## Known limitations

- **Auth is a local demo identity, not real passkey authentication.** Same caveat as the other two entries.
- **Accessibility.** The schedule uses a real `<table>` with proper `<th scope="col">`/labeled controls rather than a drag-and-drop grid, specifically so it's screen-reader operable. A full WCAG 2.2 AA audit hasn't happened yet.
- **No undo stack.** Unlike Cadence, mutations here aren't reversible via a client-side undo. The hash-chained audit log still records everything for accountability.

## Development

```bash
npm install
npm run dev
npm run worker:dev
npm run build   # runs the parity check first
npm run deploy
```

## License

MIT. See [LICENSE](./LICENSE).
