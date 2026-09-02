# Security & trust model

Relay registers ~16 [WebMCP](https://github.com/webmachinelearning/webmcp) tools with `document.modelContext`.

## What the tool surface does not expose

- **No network egress.** No tool calls anything outside this app's own Durable Object.
- **No arbitrary code execution.** Every tool has a fixed, named operation and a JSON-Schema-validated input.
- **Skill-mismatch is enforced in the shared reducer, not just the tool.** `assign`, `swap_assignments`, and `bulk_reassign` all throw `SkillMismatchError` from `src/shared/reducer.ts` if a driver lacks a job's required skill. The same check applies whether the mutation comes from a WebMCP tool, the UI, or the Durable Object's own patch application, because all three call the identical `reduce()` function.
- **`simulate_change` cannot mutate anything.** It calls `reduce()` against the current state and discards the result (see `src/tools/higher-order.ts`). It is `readOnlyHint: true` and genuinely is read-only, not a tool that claims to be a dry run while quietly writing.
- **`bulk_reassign` requires human confirmation** whether it's called by an agent (via `withConfirmation`) or triggered from the UI (a `window.confirm()` gate in `App.tsx`'s `bulkReassignChecked`). Both paths land on the same confirmation requirement, not just the tool-facing one.
- **Every mutation is attributed and audited**, appended to the hash-chained audit log (`appendAuditRecord`, vendored in `src/cf-foundation/`).

## Enforced UI/tool parity as a security property, not just a feature

`scripts/check-tool-parity.ts`, run on every `pnpm build`, asserts that Relay's mutating tools and its UI's mutating actions are exactly the same set. This has a security dimension worth naming: it means there is no "shadow" tool that grants an agent capability beyond what a human operator can do through the interface they can see, and no UI control whose blast radius an agent's grant-based scoping (`RELAY_TOOL_SCOPES`) could fail to cover.

## Out of scope for this pass

- Real authentication (see Cadence's README for the same demo-identity caveat, which applies here too).
- Rate limiting on the Durable Object's WebSocket endpoint.

Found an issue? This is a hackathon submission without a dedicated security contact; please open a GitHub issue.
