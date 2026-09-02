import type { DispatchState, Driver, Job, Vehicle } from "../src/shared/types.js";

const hour = 3_600_000;

const drivers: Driver[] = [
  { id: "d_marcus", name: "Marcus Webb", skills: ["standard", "refrigerated"], available: true },
  { id: "d_alina", name: "Alina Popescu", skills: ["standard", "hazmat"], available: true },
  { id: "d_kofi", name: "Kofi Mensah", skills: ["standard"], available: true },
  { id: "d_yuki", name: "Yuki Tanaka", skills: ["standard", "refrigerated", "hazmat"], available: false },
];

const vehicles: Vehicle[] = [
  { id: "v_101", label: "Van 101", type: "box_van", capacityKg: 1200 },
  { id: "v_102", label: "Van 102", type: "refrigerated_van", capacityKg: 900 },
  { id: "v_103", label: "Truck 103", type: "hazmat_truck", capacityKg: 3000 },
];

interface SeedJob {
  title: string;
  address: string;
  startOffsetHours: number;
  durationHours: number;
  status: Job["status"];
  driverId: string | null;
  vehicleId: string | null;
  requiredSkill: string | null;
  notes: string;
}

/**
 * Seeded with a real conflict (two jobs double-booking d_marcus with
 * overlapping windows) and a real coverage gap (a hazmat job with no
 * available hazmat-qualified driver, since the only other one, Yuki, is
 * marked unavailable) — so `list_conflicts` and `find_coverage_gaps` have
 * genuine problems to surface, not an empty result on a tidy board.
 */
const seedJobs: SeedJob[] = [
  { title: "Deliver produce pallet", address: "220 Harbor Rd", startOffsetHours: 2, durationHours: 2, status: "assigned", driverId: "d_marcus", vehicleId: "v_102", requiredSkill: "refrigerated", notes: "" },
  { title: "Deliver frozen goods", address: "88 Market St", startOffsetHours: 3, durationHours: 2, status: "assigned", driverId: "d_marcus", vehicleId: "v_102", requiredSkill: "refrigerated", notes: "Overlaps with the Harbor Rd job." },
  { title: "Hazmat drum transfer", address: "14 Industrial Way", startOffsetHours: 4, durationHours: 3, status: "unassigned", driverId: null, vehicleId: null, requiredSkill: "hazmat", notes: "Only Alina and Yuki are hazmat-certified; Yuki is off today." },
  { title: "Office supplies drop-off", address: "500 Union Ave", startOffsetHours: 1, durationHours: 1, status: "assigned", driverId: "d_kofi", vehicleId: "v_101", requiredSkill: null, notes: "" },
  { title: "Furniture delivery", address: "77 Elm St", startOffsetHours: 5, durationHours: 2, status: "unassigned", driverId: null, vehicleId: null, requiredSkill: null, notes: "" },
  { title: "Pharmacy cold-chain delivery", address: "9 Clinic Row", startOffsetHours: 6, durationHours: 1, status: "unassigned", driverId: null, vehicleId: null, requiredSkill: "refrigerated", notes: "Time-sensitive." },
  { title: "Retail restock", address: "310 Commerce Blvd", startOffsetHours: -1, durationHours: 2, status: "completed", driverId: "d_alina", vehicleId: "v_101", requiredSkill: null, notes: "" },
  { title: "Warehouse transfer", address: "60 Depot Ln", startOffsetHours: -3, durationHours: 2, status: "completed", driverId: "d_kofi", vehicleId: "v_101", requiredSkill: null, notes: "" },
  { title: "Cancelled — customer rescheduled", address: "45 Birch Ave", startOffsetHours: 8, durationHours: 1, status: "cancelled", driverId: null, vehicleId: null, requiredSkill: null, notes: "" },
];

function buildDispatch(): DispatchState {
  // Computed here, not at module scope: Cloudflare Workers doesn't
  // guarantee wall-clock time outside a request's I/O context, so a
  // `Date.now()` read at module top-level can be frozen to an arbitrary
  // fixed value rather than the real time. Calling this at request/reset
  // time gets a real clock read.
  const now = Date.now();
  const jobs: Record<string, Job> = {};
  const jobOrder: string[] = [];
  seedJobs.forEach((s, idx) => {
    const id = `seedjob_${idx}`;
    const windowStart = now + s.startOffsetHours * hour;
    jobs[id] = {
      id,
      code: `JOB-${idx + 1}`,
      title: s.title,
      address: s.address,
      windowStart,
      windowEnd: windowStart + s.durationHours * hour,
      status: s.status,
      assignedDriverId: s.driverId,
      assignedVehicleId: s.vehicleId,
      requiredSkill: s.requiredSkill,
      notes: s.notes,
      createdAt: now,
      updatedAt: now,
    };
    jobOrder.push(id);
  });

  return {
    jobs,
    drivers: Object.fromEntries(drivers.map((d) => [d.id, d])),
    vehicles: Object.fromEntries(vehicles.map((v) => [v.id, v])),
    jobOrder,
  };
}

export function seedDispatch(): DispatchState {
  return buildDispatch();
}
