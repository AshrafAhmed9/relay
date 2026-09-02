/**
 * The complete list of mutating actions the UI exposes a control for.
 * `scripts/check-tool-parity.ts` asserts this set is *exactly* the set of
 * non-read-only tools in `RELAY_TOOL_SCOPES` — every capability in the UI
 * has a paired tool with identical authority, and no tool exists that the
 * UI can't also trigger. Read-only advisory tools (`find_coverage_gaps`,
 * `simulate_change`, `optimize_schedule`) are exempt since they don't
 * mutate state and have no "UI action" of their own to pair with.
 *
 * Add a mutating tool without adding it here (or vice versa) and the
 * parity check fails — see `package.json`'s `test:parity` script.
 */
export const UI_MUTATING_ACTIONS = [
  "create_job",
  "assign",
  "unassign",
  "reschedule_assignment",
  "set_availability",
  "set_status",
  "swap_assignments",
  "bulk_reassign",
] as const;
