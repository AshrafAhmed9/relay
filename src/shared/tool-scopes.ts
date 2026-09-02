import type { ToolScopeRegistry } from "../cf-foundation/actor.js";

export const RELAY_TOOL_SCOPES: ToolScopeRegistry = {
  get_schedule: "read",
  list_conflicts: "read",
  get_resource: "read",
  list_assignments: "read",
  describe_view: "read",
  list_jobs: "read",
  list_drivers: "read",
  list_vehicles: "read",

  create_job: "triage",
  assign: "triage",
  unassign: "triage",
  reschedule_assignment: "triage",
  set_availability: "triage",
  set_status: "triage",

  find_coverage_gaps: "triage",
  simulate_change: "triage",
  optimize_schedule: "triage",

  swap_assignments: "write",
  bulk_reassign: "full",
};

/**
 * Tools annotated `readOnlyHint: true` — never mutate state, so they're
 * exempt from the UI/tool parity check (`scripts/check-tool-parity.ts`).
 * Kept here, next to the scope registry, so both stay in sync by
 * construction rather than by someone remembering to update two files.
 */
export const READ_ONLY_TOOL_NAMES = [
  "get_schedule",
  "list_conflicts",
  "get_resource",
  "list_assignments",
  "describe_view",
  "list_jobs",
  "list_drivers",
  "list_vehicles",
  "find_coverage_gaps",
  "optimize_schedule",
  "simulate_change",
] as const;
