import type { Actor } from "../cf-foundation/actor.js";
import type { ActionType } from "../shared/reducer.js";
import type { DispatchState } from "../shared/types.js";
import type { DispatchStore } from "./store.js";

export type SyncStatus = "connecting" | "open" | "closed" | "unavailable";

export function connectSync(
  store: DispatchStore,
  boardId: string,
  onStatus: (status: SyncStatus) => void,
  onSnapshot?: (state: DispatchState) => void,
): () => void {
  let ws: WebSocket | null = null;
  let closedByCaller = false;

  function connect() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    onStatus("connecting");
    try {
      ws = new WebSocket(`${proto}//${location.host}/api/dispatch/${boardId}`);
    } catch {
      onStatus("unavailable");
      return;
    }

    ws.addEventListener("open", () => onStatus("open"));
    ws.addEventListener("close", () => {
      onStatus("closed");
      if (!closedByCaller) setTimeout(connect, 2000);
    });
    ws.addEventListener("error", () => onStatus("unavailable"));

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "snapshot") {
        onSnapshot?.(msg.payload as DispatchState);
      } else if (msg.type === "patch") {
        const patch = msg.payload as { type: ActionType["type"]; payload: unknown; actor: Actor };
        store.applyRemote({ type: patch.type, payload: patch.payload } as ActionType, patch.actor);
      }
    });
  }

  store.onLocalDispatch((action, dispatchActor) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: action.type, payload: action.payload, actor: dispatchActor, timestamp: Date.now() }));
    }
  });

  connect();

  return () => {
    closedByCaller = true;
    ws?.close();
  };
}
