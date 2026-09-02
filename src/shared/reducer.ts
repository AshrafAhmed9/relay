import type { Actor } from "../cf-foundation/actor.js";
import type { DispatchState, Job, JobStatus } from "./types.js";
import { nextJobCode } from "./types.js";

/**
 * Same pattern as Cadence and Consequence: every mutation is a pure
 * `(state, actor, action) → state` function here, shared by the client
 * store, the Durable Object, and every WebMCP tool handler — and, for
 * Relay specifically, by the UI's own click handlers too. That sharing is
 * what the tool-parity check in `scripts/check-tool-parity.ts` actually
 * verifies: every UI-reachable action has a same-name tool wrapping this
 * exact function, not a parallel implementation that could drift.
 */

export class NotFoundError extends Error {
  constructor(kind: string, id: string) {
    super(`${kind} "${id}" not found.`);
    this.name = "NotFoundError";
  }
}

export class SkillMismatchError extends Error {
  constructor(driverName: string, skill: string) {
    super(`${driverName} does not have the required skill "${skill}".`);
    this.name = "SkillMismatchError";
  }
}

export class InvalidWindowError extends Error {
  constructor(windowStart: number, windowEnd: number) {
    super(
      `Invalid time window (windowStart=${windowStart}, windowEnd=${windowEnd}). Both must be absolute Unix timestamps in milliseconds (e.g. Date.now()), not a time-of-day offset, and windowEnd must be after windowStart.`,
    );
    this.name = "InvalidWindowError";
  }
}

// 2020-01-01T00:00:00Z — anything before this is almost certainly a
// misinterpreted time-of-day offset (e.g. 21600000 meaning "6am") rather
// than a real absolute timestamp, so reject it instead of silently
// corrupting the job's schedule.
const MIN_PLAUSIBLE_WINDOW_MS = 1577836800000;

function assertValidWindow(windowStart: number, windowEnd: number): void {
  if (windowEnd <= windowStart || windowStart < MIN_PLAUSIBLE_WINDOW_MS) {
    throw new InvalidWindowError(windowStart, windowEnd);
  }
}

export type ActionType =
  | { type: "create_job"; payload: { title: string; address: string; windowStart: number; windowEnd: number; requiredSkill?: string | null; notes?: string } }
  | { type: "assign"; payload: { jobId: string; driverId: string; vehicleId: string } }
  | { type: "unassign"; payload: { jobId: string } }
  | { type: "reschedule_assignment"; payload: { jobId: string; windowStart: number; windowEnd: number } }
  | { type: "swap_assignments"; payload: { jobIdA: string; jobIdB: string } }
  | { type: "set_availability"; payload: { driverId: string; available: boolean } }
  | { type: "bulk_reassign"; payload: { jobIds: string[]; driverId: string; vehicleId: string } }
  | { type: "set_status"; payload: { jobId: string; status: JobStatus } };

export interface ReduceResult {
  state: DispatchState;
  entityId: string;
  before: unknown;
  after: unknown;
}

function touch(job: Job): Job {
  return { ...job, updatedAt: Date.now() };
}

function requireJob(state: DispatchState, id: string): Job {
  const job = state.jobs[id];
  if (!job) throw new NotFoundError("Job", id);
  return job;
}

function withJob(state: DispatchState, job: Job): DispatchState {
  return { ...state, jobs: { ...state.jobs, [job.id]: job } };
}

function assertSkill(state: DispatchState, job: Job, driverId: string): void {
  if (!job.requiredSkill) return;
  const driver = state.drivers[driverId];
  if (!driver) throw new NotFoundError("Driver", driverId);
  if (!driver.skills.includes(job.requiredSkill)) throw new SkillMismatchError(driver.name, job.requiredSkill);
}

export function reduce(state: DispatchState, action: ActionType, actor: Actor): ReduceResult {
  switch (action.type) {
    case "create_job": {
      assertValidWindow(action.payload.windowStart, action.payload.windowEnd);
      const id = crypto.randomUUID();
      const existing = Object.values(state.jobs);
      const job: Job = {
        id,
        code: nextJobCode(existing),
        title: action.payload.title,
        address: action.payload.address,
        windowStart: action.payload.windowStart,
        windowEnd: action.payload.windowEnd,
        status: "unassigned",
        assignedDriverId: null,
        assignedVehicleId: null,
        requiredSkill: action.payload.requiredSkill ?? null,
        notes: action.payload.notes ?? "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return {
        state: { ...state, jobs: { ...state.jobs, [id]: job }, jobOrder: [id, ...state.jobOrder] },
        entityId: id,
        before: null,
        after: job,
      };
    }

    case "assign": {
      const before = requireJob(state, action.payload.jobId);
      if (!state.drivers[action.payload.driverId]) throw new NotFoundError("Driver", action.payload.driverId);
      if (!state.vehicles[action.payload.vehicleId]) throw new NotFoundError("Vehicle", action.payload.vehicleId);
      assertSkill(state, before, action.payload.driverId);
      const after = touch({
        ...before,
        assignedDriverId: action.payload.driverId,
        assignedVehicleId: action.payload.vehicleId,
        status: "assigned" as JobStatus,
      });
      return { state: withJob(state, after), entityId: after.id, before, after };
    }

    case "unassign": {
      const before = requireJob(state, action.payload.jobId);
      const after = touch({ ...before, assignedDriverId: null, assignedVehicleId: null, status: "unassigned" as JobStatus });
      return { state: withJob(state, after), entityId: after.id, before, after };
    }

    case "reschedule_assignment": {
      assertValidWindow(action.payload.windowStart, action.payload.windowEnd);
      const before = requireJob(state, action.payload.jobId);
      const after = touch({ ...before, windowStart: action.payload.windowStart, windowEnd: action.payload.windowEnd });
      return { state: withJob(state, after), entityId: after.id, before, after };
    }

    case "swap_assignments": {
      const jobA = requireJob(state, action.payload.jobIdA);
      const jobB = requireJob(state, action.payload.jobIdB);
      if (jobA.assignedDriverId) assertSkill(state, jobB, jobA.assignedDriverId);
      if (jobB.assignedDriverId) assertSkill(state, jobA, jobB.assignedDriverId);
      const newA = touch({ ...jobA, assignedDriverId: jobB.assignedDriverId, assignedVehicleId: jobB.assignedVehicleId });
      const newB = touch({ ...jobB, assignedDriverId: jobA.assignedDriverId, assignedVehicleId: jobA.assignedVehicleId });
      let next = withJob(state, newA);
      next = withJob(next, newB);
      return { state: next, entityId: `${jobA.id},${jobB.id}`, before: [jobA, jobB], after: [newA, newB] };
    }

    case "set_availability": {
      const driver = state.drivers[action.payload.driverId];
      if (!driver) throw new NotFoundError("Driver", action.payload.driverId);
      const after = { ...driver, available: action.payload.available };
      return {
        state: { ...state, drivers: { ...state.drivers, [driver.id]: after } },
        entityId: driver.id,
        before: driver,
        after,
      };
    }

    case "bulk_reassign": {
      let next = state;
      const before: Job[] = [];
      const after: Job[] = [];
      for (const jobId of action.payload.jobIds) {
        const job = requireJob(next, jobId);
        assertSkill(next, job, action.payload.driverId);
        before.push(job);
        const updated = touch({ ...job, assignedDriverId: action.payload.driverId, assignedVehicleId: action.payload.vehicleId, status: "assigned" as JobStatus });
        next = withJob(next, updated);
        after.push(updated);
      }
      return { state: next, entityId: action.payload.jobIds.join(","), before, after };
    }

    case "set_status": {
      const before = requireJob(state, action.payload.jobId);
      const after = touch({ ...before, status: action.payload.status });
      return { state: withJob(state, after), entityId: after.id, before, after };
    }
  }
}

