import type { Actor } from "../cf-foundation/actor.js";
import type { ActionType } from "../shared/reducer.js";
import { reduce } from "../shared/reducer.js";
import type { DispatchState } from "../shared/types.js";

export type StoreListener = (state: DispatchState) => void;

export function createDispatchStore(initial: DispatchState) {
  let state = initial;
  const listeners = new Set<StoreListener>();
  let onDispatch: ((action: ActionType, actor: Actor) => void) | null = null;

  function getState(): DispatchState {
    return state;
  }

  function subscribe(listener: StoreListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function notify(): void {
    for (const listener of listeners) listener(state);
  }

  function onLocalDispatch(handler: (action: ActionType, actor: Actor) => void): void {
    onDispatch = handler;
  }

  function dispatch(action: ActionType, actor: Actor, options: { broadcast?: boolean } = {}): unknown {
    const result = reduce(state, action, actor);
    state = result.state;
    notify();
    if (options.broadcast !== false) onDispatch?.(action, actor);
    return result.after;
  }

  function applyRemote(action: ActionType, actor: Actor): void {
    state = reduce(state, action, actor).state;
    notify();
  }

  function hydrate(next: DispatchState): void {
    state = next;
    notify();
  }

  return { getState, subscribe, dispatch, applyRemote, hydrate, onLocalDispatch };
}

export type DispatchStore = ReturnType<typeof createDispatchStore>;
