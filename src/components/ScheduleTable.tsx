import { useState } from "react";
import type { Actor } from "../cf-foundation/actor.js";
import type { DispatchState } from "../shared/types.js";
import { listConflicts } from "../shared/derive.js";
import type { DispatchStore } from "../lib/store.js";

const hour = 3_600_000;

/**
 * Every button here dispatches an action from `UI_MUTATING_ACTIONS`
 * (`src/shared/ui-actions.ts`) — the same set `scripts/check-tool-parity.ts`
 * asserts is exactly the set of non-read-only WebMCP tools. There is no
 * action a mouse can take here that an agent's tool call can't also take,
 * and no mutating tool without a UI control here.
 */
export function ScheduleTable({
  state,
  store,
  human,
  checkedIds,
  onToggleCheck,
}: {
  state: DispatchState;
  store: DispatchStore;
  human: Actor;
  checkedIds: Set<string>;
  onToggleCheck: (id: string, checked: boolean) => void;
}) {
  const conflicts = listConflicts(state);
  const conflictedJobIds = new Set(conflicts.flatMap((c) => c.jobIds));
  const [swapTarget, setSwapTarget] = useState<Record<string, string>>({});

  const jobs = state.jobOrder.map((id) => state.jobs[id]).filter(Boolean);

  return (
    <table className="schedule">
      <caption>Dispatch schedule — {jobs.length} jobs, {conflicts.length} conflict(s)</caption>
      <thead>
        <tr>
          <th scope="col"><span className="visually-hidden">Select</span></th>
          <th scope="col">Job</th>
          <th scope="col">Window</th>
          <th scope="col">Status</th>
          <th scope="col">Driver</th>
          <th scope="col">Vehicle</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id} className={conflictedJobIds.has(job.id) ? "conflict" : undefined}>
            <td>
              <input
                type="checkbox"
                checked={checkedIds.has(job.id)}
                onChange={(e) => onToggleCheck(job.id, e.target.checked)}
                aria-label={`Select ${job.code} for bulk reassignment`}
              />
            </td>
            <td>
              <strong>{job.code}</strong> {job.title}
              {job.requiredSkill && <div style={{ color: "var(--text-faint)", fontSize: 10 }}>requires: {job.requiredSkill}</div>}
            </td>
            <td>{new Date(job.windowStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{new Date(job.windowEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
            <td>
              <label className="visually-hidden" htmlFor={`status-${job.id}`}>Status for {job.code}</label>
              <select
                id={`status-${job.id}`}
                value={job.status}
                onChange={(e) => store.dispatch({ type: "set_status", payload: { jobId: job.id, status: e.target.value as DispatchState["jobs"][string]["status"] } }, human)}
              >
                <option value="unassigned">unassigned</option>
                <option value="assigned">assigned</option>
                <option value="in_transit">in_transit</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </td>
            <td>
              <label className="visually-hidden" htmlFor={`driver-${job.id}`}>Driver for {job.code}</label>
              <select
                id={`driver-${job.id}`}
                value={job.assignedDriverId ?? ""}
                onChange={(e) => {
                  if (!e.target.value) {
                    store.dispatch({ type: "unassign", payload: { jobId: job.id } }, human);
                  } else {
                    const vehicleId = job.assignedVehicleId ?? Object.keys(state.vehicles)[0];
                    store.dispatch({ type: "assign", payload: { jobId: job.id, driverId: e.target.value, vehicleId } }, human);
                  }
                }}
              >
                <option value="">— unassigned —</option>
                {Object.values(state.drivers).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{!d.available ? " (off)" : ""}</option>
                ))}
              </select>
            </td>
            <td>
              <label className="visually-hidden" htmlFor={`vehicle-${job.id}`}>Vehicle for {job.code}</label>
              <select
                id={`vehicle-${job.id}`}
                value={job.assignedVehicleId ?? ""}
                disabled={!job.assignedDriverId}
                onChange={(e) => job.assignedDriverId && store.dispatch({ type: "assign", payload: { jobId: job.id, driverId: job.assignedDriverId, vehicleId: e.target.value } }, human)}
              >
                <option value="">—</option>
                {Object.values(state.vehicles).map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            </td>
            <td className="job-actions">
              <button
                onClick={() =>
                  store.dispatch({ type: "reschedule_assignment", payload: { jobId: job.id, windowStart: job.windowStart + hour, windowEnd: job.windowEnd + hour } }, human)
                }
              >
                +1h
              </button>
              <label className="visually-hidden" htmlFor={`swap-${job.id}`}>Swap {job.code} with</label>
              <select
                id={`swap-${job.id}`}
                value={swapTarget[job.id] ?? ""}
                onChange={(e) => setSwapTarget((prev) => ({ ...prev, [job.id]: e.target.value }))}
              >
                <option value="">swap with…</option>
                {jobs.filter((j) => j.id !== job.id).map((j) => (
                  <option key={j.id} value={j.id}>{j.code}</option>
                ))}
              </select>
              <button
                disabled={!swapTarget[job.id]}
                onClick={() => {
                  store.dispatch({ type: "swap_assignments", payload: { jobIdA: job.id, jobIdB: swapTarget[job.id] } }, human);
                  setSwapTarget((prev) => ({ ...prev, [job.id]: "" }));
                }}
              >
                Swap
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
