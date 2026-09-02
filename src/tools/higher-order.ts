import type { Actor } from "../cf-foundation/actor.js";
import { defineTool, withConfirmation, type ConfirmFn } from "webmcp-kit";
import type { DispatchStore } from "../lib/store.js";
import { reduce, type ActionType } from "../shared/reducer.js";
import { findCoverageGaps, listConflicts } from "../shared/derive.js";
import type { DispatchState } from "../shared/types.js";

export interface HigherOrderDeps {
  confirmBulkReassign: ConfirmFn<any>;
}

export function createHigherOrderTools(store: DispatchStore, actor: Actor, deps: HigherOrderDeps) {
  const findCoverageGapsTool = defineTool({
    name: "find_coverage_gaps",
    description: "Find jobs with no driver assigned, distinguishing 'nobody assigned yet' from 'no qualified driver is currently available'.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      return findCoverageGaps(store.getState());
    },
  });

  const optimizeSchedule = defineTool({
    name: "optimize_schedule",
    description: "Propose driver/vehicle assignments to close coverage gaps. Returns proposals only — call assign or bulk_reassign to actually apply one.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      const state = store.getState();
      const gaps = findCoverageGaps(state);
      const vehicles = Object.values(state.vehicles);
      const proposals: { jobId: string; jobCode: string; proposedDriverId: string; proposedVehicleId: string | null }[] = [];
      for (const gap of gaps) {
        const job = state.jobs[gap.jobId];
        const candidate = Object.values(state.drivers).find(
          (d) => d.available && (!job.requiredSkill || d.skills.includes(job.requiredSkill)),
        );
        if (candidate) {
          proposals.push({ jobId: job.id, jobCode: job.code, proposedDriverId: candidate.id, proposedVehicleId: vehicles[0]?.id ?? null });
        }
      }
      return proposals;
    },
  });

  const simulateChange = defineTool({
    name: "simulate_change",
    description:
      "Dry-run a proposed change (assign, reschedule_assignment, swap_assignments, unassign, set_status, or bulk_reassign) and return what would change, without applying it. Use before a consequential change to preview the effect.",
    inputSchema: {
      type: "object",
      properties: {
        actionType: { type: "string", enum: ["assign", "reschedule_assignment", "swap_assignments", "unassign", "set_status", "bulk_reassign"] as const },
        payload: { type: "object", properties: {} },
      },
      required: ["actionType", "payload"],
      additionalProperties: false,
    } as const,
    annotations: { readOnlyHint: true },
    handler(input) {
      const state = store.getState();
      try {
        const result = reduce(state, { type: input.actionType, payload: input.payload } as ActionType, actor);
        const conflictsBefore = listConflicts(state);
        const conflictsAfter = listConflicts(result.state as DispatchState);
        return {
          wouldSucceed: true,
          before: result.before,
          after: result.after,
          newConflictCount: conflictsAfter.length - conflictsBefore.length,
        };
      } catch (err) {
        return { wouldSucceed: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  });

  const swapAssignments = defineTool({
    name: "swap_assignments",
    description: "Swap the driver/vehicle assignments between two jobs.",
    inputSchema: {
      type: "object",
      properties: { jobIdA: { type: "string" }, jobIdB: { type: "string" } },
      required: ["jobIdA", "jobIdB"],
      additionalProperties: false,
    } as const,
    handler(input) {
      store.dispatch({ type: "swap_assignments", payload: input }, actor);
      return { ok: true };
    },
  });

  const bulkReassignBase = {
    name: "bulk_reassign",
    description: "Reassign many jobs to one driver/vehicle at once. Requires human confirmation.",
    inputSchema: {
      type: "object",
      properties: { jobIds: { type: "array", items: { type: "string" } }, driverId: { type: "string" }, vehicleId: { type: "string" } },
      required: ["jobIds", "driverId", "vehicleId"],
      additionalProperties: false,
    } as const,
    handler(input: { jobIds: string[]; driverId: string; vehicleId: string }) {
      store.dispatch({ type: "bulk_reassign", payload: input }, actor);
      return { ok: true, count: input.jobIds.length };
    },
  };
  const bulkReassign = withConfirmation(bulkReassignBase, deps.confirmBulkReassign);

  return { findCoverageGapsTool, optimizeSchedule, simulateChange, swapAssignments, bulkReassign };
}
