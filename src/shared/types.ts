export type JobStatus = "unassigned" | "assigned" | "in_transit" | "completed" | "cancelled";

export interface Driver {
  id: string;
  name: string;
  skills: string[];
  available: boolean;
}

export interface Vehicle {
  id: string;
  label: string;
  type: string;
  capacityKg: number;
}

export interface Job {
  id: string;
  code: string; // "JOB-142"
  title: string;
  address: string;
  windowStart: number;
  windowEnd: number;
  status: JobStatus;
  assignedDriverId: string | null;
  assignedVehicleId: string | null;
  requiredSkill: string | null;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface DispatchState {
  jobs: Record<string, Job>;
  drivers: Record<string, Driver>;
  vehicles: Record<string, Vehicle>;
  jobOrder: string[];
}

export function nextJobCode(existing: Job[]): string {
  const max = existing.reduce((m, j) => {
    const n = Number(j.code.split("-")[1] ?? 0);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `JOB-${max + 1}`;
}
