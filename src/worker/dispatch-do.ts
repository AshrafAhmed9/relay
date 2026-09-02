import { SyncedDurableObject, type Actor, type Patch } from "../cf-foundation/index.js";
import { reduce, type ActionType } from "../shared/reducer.js";
import type { DispatchState } from "../shared/types.js";
import { seedDispatch } from "../../seed/jobs.js";

export class DispatchDurableObject extends SyncedDurableObject {
  private cached: DispatchState | null = null;

  private async loadState(): Promise<DispatchState> {
    if (this.cached) return this.cached;
    const stored = await this.state.storage.get<DispatchState>("dispatch");
    this.cached = stored ?? seedDispatch();
    if (!stored) await this.state.storage.put("dispatch", this.cached);
    return this.cached;
  }

  protected async snapshot(): Promise<DispatchState> {
    return this.loadState();
  }

  protected async applyPatch(patch: Patch): Promise<{ entityId: string; before: unknown; after: unknown }> {
    const state = await this.loadState();
    const action = { type: patch.type, payload: patch.payload } as ActionType;
    const result = reduce(state, action, patch.actor as Actor);
    this.cached = result.state;
    await this.state.storage.put("dispatch", this.cached);
    return { entityId: result.entityId, before: result.before, after: result.after };
  }

  protected async resetState(): Promise<void> {
    this.cached = seedDispatch();
    await this.state.storage.put("dispatch", this.cached);
  }
}
