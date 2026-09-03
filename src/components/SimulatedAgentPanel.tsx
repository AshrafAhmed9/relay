import { useState } from "react";
import type { ActivityLog, DefinedTool } from "@ashraf009/webmcp-kit";

function findTool(tools: DefinedTool<any, any>[], name: string): DefinedTool<any, any> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool "${name}"`);
  return tool;
}

async function runLogged(tools: DefinedTool<any, any>[], log: ActivityLog, name: string, input: unknown) {
  const tool = findTool(tools, name);
  const start = performance.now();
  try {
    const output = await tool.call(input as never);
    log.log({ toolName: name, input, output, actor: "agent", durationMs: performance.now() - start });
    return output;
  } catch (err) {
    log.log({ toolName: name, input, output: undefined, error: err instanceof Error ? err.message : String(err), actor: "agent", durationMs: performance.now() - start });
    throw err;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function SimulatedAgentPanel({ allTools, activityLog }: { allTools: DefinedTool<any, any>[]; activityLog: ActivityLog }) {
  const [running, setRunning] = useState<string | null>(null);

  async function runCloseGaps() {
    setRunning("gaps");
    try {
      const proposals = (await runLogged(allTools, activityLog, "optimize_schedule", {})) as {
        jobId: string;
        proposedDriverId: string;
        proposedVehicleId: string | null;
      }[];
      for (const p of proposals) {
        await delay(300);
        if (p.proposedVehicleId) {
          await runLogged(allTools, activityLog, "assign", { jobId: p.jobId, driverId: p.proposedDriverId, vehicleId: p.proposedVehicleId });
        }
      }
    } finally {
      setRunning(null);
    }
  }

  async function runResolveConflicts() {
    setRunning("conflicts");
    try {
      const conflicts = (await runLogged(allTools, activityLog, "list_conflicts", {})) as { jobIds: string[] }[];
      for (const c of conflicts) {
        await delay(300);
        const schedule = (await runLogged(allTools, activityLog, "get_schedule", {})) as { id: string; windowStart: number; windowEnd: number }[];
        const job = schedule.find((j) => j.id === c.jobIds[1]);
        if (job) {
          await runLogged(allTools, activityLog, "reschedule_assignment", {
            jobId: job.id,
            windowStart: job.windowStart + 3_600_000,
            windowEnd: job.windowEnd + 3_600_000,
          });
        }
      }
    } finally {
      setRunning(null);
    }
  }

  async function runPreviewBulk() {
    setRunning("preview");
    try {
      const gaps = (await runLogged(allTools, activityLog, "find_coverage_gaps", {})) as { jobId: string }[];
      const jobIds = gaps.map((g) => g.jobId).slice(0, 2);
      if (jobIds.length > 0) {
        await runLogged(allTools, activityLog, "simulate_change", {
          actionType: "bulk_reassign",
          payload: { jobIds, driverId: "d_alina", vehicleId: "v_101" },
        });
      }
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="simulated-agent">
      <h4>Simulated agent (works without WebMCP)</h4>
      <button disabled={running !== null} onClick={runCloseGaps}>
        {running === "gaps" ? "Assigning…" : "Close coverage gaps"}
      </button>
      <button disabled={running !== null} onClick={runResolveConflicts}>
        {running === "conflicts" ? "Resolving…" : "Resolve conflicts"}
      </button>
      <button disabled={running !== null} onClick={runPreviewBulk}>
        {running === "preview" ? "Previewing…" : "Preview a bulk reassign (dry run)"}
      </button>
    </div>
  );
}
