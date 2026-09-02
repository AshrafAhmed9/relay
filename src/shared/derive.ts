import type { DispatchState, Job } from "./types.js";

export interface Conflict {
  id: string;
  driverId: string;
  driverName: string;
  jobIds: string[];
  overlapMinutes: number;
}

function overlaps(a: Job, b: Job): number {
  const start = Math.max(a.windowStart, b.windowStart);
  const end = Math.min(a.windowEnd, b.windowEnd);
  return Math.max(0, end - start);
}

/** Two jobs assigned to the same driver with overlapping time windows. */
export function listConflicts(state: DispatchState): Conflict[] {
  const byDriver = new Map<string, Job[]>();
  for (const job of Object.values(state.jobs)) {
    if (!job.assignedDriverId || job.status === "cancelled" || job.status === "completed") continue;
    const list = byDriver.get(job.assignedDriverId) ?? [];
    list.push(job);
    byDriver.set(job.assignedDriverId, list);
  }
  const conflicts: Conflict[] = [];
  for (const [driverId, jobs] of byDriver) {
    for (let i = 0; i < jobs.length; i++) {
      for (let j = i + 1; j < jobs.length; j++) {
        const overlapMs = overlaps(jobs[i], jobs[j]);
        if (overlapMs > 0) {
          conflicts.push({
            id: `${jobs[i].id}:${jobs[j].id}`,
            driverId,
            driverName: state.drivers[driverId]?.name ?? driverId,
            jobIds: [jobs[i].id, jobs[j].id],
            overlapMinutes: Math.round(overlapMs / 60000),
          });
        }
      }
    }
  }
  return conflicts;
}

export interface CoverageGap {
  jobId: string;
  jobCode: string;
  reason: "unassigned" | "no_qualified_driver_available";
}

/** Unassigned jobs, and jobs whose required skill has no currently-available driver. */
export function findCoverageGaps(state: DispatchState): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  for (const job of Object.values(state.jobs)) {
    if (job.status === "cancelled" || job.status === "completed") continue;
    if (job.status === "unassigned") {
      const qualifiedAvailable = Object.values(state.drivers).some(
        (d) => d.available && (!job.requiredSkill || d.skills.includes(job.requiredSkill)),
      );
      gaps.push({ jobId: job.id, jobCode: job.code, reason: qualifiedAvailable ? "unassigned" : "no_qualified_driver_available" });
    }
  }
  return gaps;
}
