import type { Actor } from "../cf-foundation/actor.js";
import { defineTool } from "webmcp-kit";
import type { DispatchStore } from "../lib/store.js";

export function createWriteTools(store: DispatchStore, actor: Actor) {
  const createJob = defineTool({
    name: "create_job",
    description: "Create a new delivery job.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        address: { type: "string" },
        windowStart: { type: "number", description: "Absolute Unix timestamp in milliseconds (e.g. Date.now()), not a time-of-day offset." },
        windowEnd: { type: "number", description: "Absolute Unix timestamp in milliseconds, after windowStart." },
        requiredSkill: { type: "string" },
        notes: { type: "string" },
      },
      required: ["title", "address", "windowStart", "windowEnd"],
      additionalProperties: false,
    } as const,
    handler(input) {
      store.dispatch({ type: "create_job", payload: input }, actor);
      const state = store.getState();
      const created = Object.values(state.jobs).sort((a, b) => b.createdAt - a.createdAt)[0];
      return { created: created ? { id: created.id, code: created.code } : null };
    },
  });

  const assign = defineTool({
    name: "assign",
    description: "Assign a job to a driver and vehicle. Refuses if the driver lacks the job's required skill.",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string" }, driverId: { type: "string" }, vehicleId: { type: "string" } },
      required: ["jobId", "driverId", "vehicleId"],
      additionalProperties: false,
    } as const,
    handler(input) {
      store.dispatch({ type: "assign", payload: input }, actor);
      return { ok: true };
    },
  });

  const unassign = defineTool({
    name: "unassign",
    description: "Remove a job's current driver/vehicle assignment, returning it to unassigned.",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string" } },
      required: ["jobId"],
      additionalProperties: false,
    } as const,
    handler(input) {
      store.dispatch({ type: "unassign", payload: input }, actor);
      return { ok: true };
    },
  });

  const rescheduleAssignment = defineTool({
    name: "reschedule_assignment",
    description: "Change a job's time window.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        windowStart: { type: "number", description: "Absolute Unix timestamp in milliseconds (e.g. Date.now()), not a time-of-day offset." },
        windowEnd: { type: "number", description: "Absolute Unix timestamp in milliseconds, after windowStart." },
      },
      required: ["jobId", "windowStart", "windowEnd"],
      additionalProperties: false,
    } as const,
    handler(input) {
      store.dispatch({ type: "reschedule_assignment", payload: input }, actor);
      return { ok: true };
    },
  });

  const setAvailability = defineTool({
    name: "set_availability",
    description: "Mark a driver as available or unavailable.",
    inputSchema: {
      type: "object",
      properties: { driverId: { type: "string" }, available: { type: "boolean" } },
      required: ["driverId", "available"],
      additionalProperties: false,
    } as const,
    handler(input) {
      store.dispatch({ type: "set_availability", payload: input }, actor);
      return { ok: true };
    },
  });

  const setStatus = defineTool({
    name: "set_status",
    description: "Change a job's status (e.g. mark in_transit, completed, or cancelled).",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string" }, status: { type: "string", enum: ["unassigned", "assigned", "in_transit", "completed", "cancelled"] as const } },
      required: ["jobId", "status"],
      additionalProperties: false,
    } as const,
    handler(input) {
      store.dispatch({ type: "set_status", payload: input }, actor);
      return { ok: true };
    },
  });

  return { createJob, assign, unassign, rescheduleAssignment, setAvailability, setStatus };
}
