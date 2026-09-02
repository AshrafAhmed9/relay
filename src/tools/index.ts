import type { Actor } from "../cf-foundation/actor.js";
import type { DispatchStore } from "../lib/store.js";
import { createReadTools, type ViewState } from "./read.js";
import { createWriteTools } from "./write.js";
import { createHigherOrderTools, type HigherOrderDeps } from "./higher-order.js";

export type { ViewState } from "./read.js";

export function createRelayTools(params: {
  store: DispatchStore;
  actor: Actor;
  getView: () => ViewState;
  confirmations: HigherOrderDeps;
}) {
  const read = createReadTools(params.store, params.getView);
  const write = createWriteTools(params.store, params.actor);
  const higherOrder = createHigherOrderTools(params.store, params.actor, params.confirmations);

  return {
    read: Object.values(read),
    write: Object.values(write),
    higherOrder: Object.values(higherOrder),
    all: [...Object.values(read), ...Object.values(write), ...Object.values(higherOrder)],
  };
}
