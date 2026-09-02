import { useMemo, useState } from "react";
import type { Actor } from "../cf-foundation/actor.js";
import { resolveToolNames } from "../cf-foundation/actor.js";
import { createActivityLog, type ConfirmFn, type DefinedTool } from "webmcp-kit";
import { useScopedTools } from "webmcp-kit/react";
import type { DispatchStore } from "./store.js";
import { createRelayTools, type ViewState } from "../tools/index.js";
import { RELAY_TOOL_SCOPES } from "../shared/tool-scopes.js";

export type ConfirmRequest = { message: string; resolve: (approved: boolean) => void };

export function useRelayTools(store: DispatchStore, agent: Actor, view: ViewState) {
  const activityLog = useMemo(() => createActivityLog(), []);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);

  const confirmBulkReassign: ConfirmFn<any> = useMemo(
    () =>
      ((input: { jobIds: string[] }) =>
        new Promise<boolean>((resolve) =>
          setConfirmRequest({ message: `Reassign ${input.jobIds.length} job(s) to a new driver?`, resolve: (v) => { setConfirmRequest(null); resolve(v); } }),
        )) as unknown as ConfirmFn<any>,
    [],
  );

  const tools = useMemo(
    () =>
      createRelayTools({
        store,
        actor: agent,
        getView: () => view,
        confirmations: { confirmBulkReassign },
      }),
    [store, agent, view, confirmBulkReassign],
  );

  const allowed = useMemo(() => new Set(resolveToolNames(RELAY_TOOL_SCOPES, agent)), [agent]);
  const filterAllowed = (list: DefinedTool<any, any>[]) => list.filter((t) => allowed.has(t.name));

  const onInvoke = (entry: { toolName: string; input: unknown; output: unknown; error?: string; durationMs: number }) => {
    activityLog.log({ ...entry, actor: agent.kind });
  };

  useScopedTools(true, () => filterAllowed(tools.all), { onInvoke }, [tools]);

  const registeredCount = filterAllowed(tools.all).length;

  return { tools, activityLog, confirmRequest, registeredCount };
}
