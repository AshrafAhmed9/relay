import { defineTool } from "webmcp-kit";
import type { DispatchStore } from "../lib/store.js";
import { listConflicts } from "../shared/derive.js";

export interface ViewState {
  filterDriverId: string | null;
  selectedJobId: string | null;
}

export function createReadTools(store: DispatchStore, getView: () => ViewState) {
  const getSchedule = defineTool({
    name: "get_schedule",
    description: "Get all jobs on the schedule, with their assignment status and time windows.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      return Object.values(store.getState().jobs).map((j) => ({
        id: j.id,
        code: j.code,
        title: j.title,
        status: j.status,
        windowStart: j.windowStart,
        windowEnd: j.windowEnd,
        assignedDriverId: j.assignedDriverId,
        assignedVehicleId: j.assignedVehicleId,
        requiredSkill: j.requiredSkill,
      }));
    },
  });

  const listConflictsTool = defineTool({
    name: "list_conflicts",
    description: "List scheduling conflicts: a driver double-booked across overlapping time windows.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      return listConflicts(store.getState());
    },
  });

  const getResource = defineTool({
    name: "get_resource",
    description: "Get details of one driver or vehicle by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, kind: { type: "string", enum: ["driver", "vehicle"] as const } },
      required: ["id", "kind"],
      additionalProperties: false,
    } as const,
    annotations: { readOnlyHint: true },
    handler(input) {
      const state = store.getState();
      const resource = input.kind === "driver" ? state.drivers[input.id] : state.vehicles[input.id];
      return resource ?? { error: `${input.kind} "${input.id}" not found.` };
    },
  });

  const listAssignments = defineTool({
    name: "list_assignments",
    description: "List all currently assigned jobs with their driver and vehicle.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      const state = store.getState();
      return Object.values(state.jobs)
        .filter((j) => j.assignedDriverId)
        .map((j) => ({
          jobCode: j.code,
          driver: state.drivers[j.assignedDriverId!]?.name ?? j.assignedDriverId,
          vehicle: state.vehicles[j.assignedVehicleId!]?.label ?? j.assignedVehicleId,
          windowStart: j.windowStart,
          windowEnd: j.windowEnd,
        }));
    },
  });

  const describeView = defineTool({
    name: "describe_view",
    description: "Get what the human currently has filtered or selected in the UI.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      return getView();
    },
  });

  const listJobs = defineTool({
    name: "list_jobs",
    description: "List jobs, optionally filtered by status.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", enum: ["unassigned", "assigned", "in_transit", "completed", "cancelled"] as const } },
      required: [],
      additionalProperties: false,
    } as const,
    annotations: { readOnlyHint: true },
    handler(input) {
      const jobs = Object.values(store.getState().jobs);
      return (input.status ? jobs.filter((j) => j.status === input.status) : jobs).map((j) => ({ id: j.id, code: j.code, title: j.title, status: j.status }));
    },
  });

  const listDrivers = defineTool({
    name: "list_drivers",
    description: "List all drivers with their skills and availability.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      return Object.values(store.getState().drivers);
    },
  });

  const listVehicles = defineTool({
    name: "list_vehicles",
    description: "List all vehicles.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false } as const,
    annotations: { readOnlyHint: true },
    handler() {
      return Object.values(store.getState().vehicles);
    },
  });

  return { getSchedule, listConflictsTool, getResource, listAssignments, describeView, listJobs, listDrivers, listVehicles };
}
