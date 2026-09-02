import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isWebMCPAvailable } from "webmcp-kit";
import type { PermissionScope } from "../cf-foundation/actor.js";
import { createDispatchStore } from "../lib/store.js";
import { connectSync, type SyncStatus } from "../lib/sync.js";
import { loadOrCreateIdentity } from "../lib/identity.js";
import { useRelayTools } from "../lib/useRelayTools.js";
import { seedDispatch } from "../../seed/jobs.js";
import { findCoverageGaps, listConflicts } from "../shared/derive.js";
import { ScheduleTable } from "./ScheduleTable.js";
import { ActivityFeed } from "./ActivityFeed.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { WebMCPBanner } from "./WebMCPBanner.js";
import { SimulatedAgentPanel } from "./SimulatedAgentPanel.js";
import "./styles.css";

const identity = loadOrCreateIdentity();
const store = createDispatchStore(seedDispatch());

export function App() {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [webMCPAvailable] = useState(isWebMCPAvailable());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");
  const [scope, setScope] = useState<PermissionScope>("full");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const agent = useMemo(() => identity.makeAgent(scope), [scope]);
  const view = useMemo(() => ({ filterDriverId: null, selectedJobId: null }), []);
  const { tools, activityLog, confirmRequest, registeredCount } = useRelayTools(store, agent, view);

  useEffect(() => {
    const disconnect = connectSync(store, identity.human.userId, setSyncStatus, (snapshot) => store.hydrate(snapshot));
    return disconnect;
  }, []);

  const conflicts = listConflicts(state);
  const gaps = findCoverageGaps(state);

  function createSampleJob() {
    store.dispatch(
      {
        type: "create_job",
        payload: {
          title: "New delivery",
          address: "TBD",
          windowStart: Date.now() + 6 * 3_600_000,
          windowEnd: Date.now() + 7 * 3_600_000,
        },
      },
      identity.human,
    );
  }

  function bulkReassignChecked() {
    const driverId = Object.keys(state.drivers)[0];
    const vehicleId = Object.keys(state.vehicles)[0];
    if (!driverId || !vehicleId || checkedIds.size === 0) return;
    const driverName = state.drivers[driverId]?.name ?? driverId;
    if (!window.confirm(`Reassign ${checkedIds.size} job(s) to ${driverName}?`)) return;
    store.dispatch({ type: "bulk_reassign", payload: { jobIds: [...checkedIds], driverId, vehicleId } }, identity.human);
    setCheckedIds(new Set());
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">Relay</span>
        <span style={{ color: "var(--text-faint)" }}>{identity.human.name}</span>
        <div className="spacer" />
        <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Agent grant:{" "}
          <select value={scope} onChange={(e) => setScope(e.target.value as PermissionScope)} aria-label="Agent permission scope">
            <option value="read">read</option>
            <option value="triage">triage</option>
            <option value="write">write</option>
            <option value="full">full</option>
          </select>
        </label>
        <span className={`tool-count${registeredCount > 0 ? " pulse" : ""}`}>
          {webMCPAvailable ? `${registeredCount} tools live` : "WebMCP unavailable"}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>sync: {syncStatus}</span>
        <button onClick={createSampleJob}>+ New job</button>
        <button disabled={checkedIds.size === 0} onClick={bulkReassignChecked}>
          Bulk reassign selected ({checkedIds.size})
        </button>
        <button
          title="Wipe this schedule back to the seeded starting data. Only affects your own schedule."
          onClick={async () => {
            if (!confirm("Reset this schedule back to the seeded starting data? This can't be undone.")) return;
            const res = await fetch(`/api/dispatch/${identity.human.userId}/reset-if-idle`, { method: "POST" });
            const body = await res.json().catch(() => null);
            if (body?.reset) location.reload();
            else alert("Schedule was touched in the last 2 minutes — try again shortly.");
          }}
        >
          Reset demo data
        </button>
      </header>

      <WebMCPBanner available={webMCPAvailable} />

      <div className="alert-bar">
        <span className={`stat${conflicts.length > 0 ? " error" : ""}`}>{conflicts.length} conflict(s)</span>
        <span className={`stat${gaps.length > 0 ? " warning" : ""}`}>{gaps.length} coverage gap(s)</span>
        {Object.values(state.drivers).map((d) => (
          <label key={d.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={d.available}
              onChange={(e) => store.dispatch({ type: "set_availability", payload: { driverId: d.id, available: e.target.checked } }, identity.human)}
            />
            {d.name}
          </label>
        ))}
      </div>

      <main className="main-column">
        <ScheduleTable
          state={state}
          store={store}
          human={identity.human}
          checkedIds={checkedIds}
          onToggleCheck={(id, checked) =>
            setCheckedIds((prev) => {
              const next = new Set(prev);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            })
          }
        />
      </main>

      <aside className="sidebar">
        <div className="sidebar-header">Agent activity</div>
        <ActivityFeed log={activityLog} />
        <SimulatedAgentPanel allTools={tools.all} activityLog={activityLog} />
      </aside>

      <ConfirmDialog request={confirmRequest} />
    </div>
  );
}
