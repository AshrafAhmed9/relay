export { DispatchDurableObject } from "./dispatch-do.js";

export interface Env {
  DISPATCH: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/dispatch/")) {
      const boardId = url.pathname.split("/")[3] ?? "demo";
      const id = env.DISPATCH.idFromName(boardId);
      const stub = env.DISPATCH.get(id);
      return stub.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
