import type { AgentActor, HumanActor, PermissionScope } from "../cf-foundation/actor.js";

const STORAGE_KEY = "relay.identity.v1";

function randomName(): string {
  const names = ["Dispatcher Reyes", "Dispatcher Okafor", "Dispatcher Lindqvist", "Dispatcher Tanaka"];
  return names[Math.floor(Math.random() * names.length)];
}

export function loadOrCreateIdentity(): { human: HumanActor; makeAgent: (scope: PermissionScope) => AgentActor } {
  let raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  let parsed: { userId: string; name: string } | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (!parsed) {
    parsed = { userId: crypto.randomUUID(), name: randomName() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // storage unavailable — identity just won't persist across reloads
    }
  }
  const human: HumanActor = { kind: "human", userId: parsed.userId, name: parsed.name };
  const makeAgent = (scope: PermissionScope): AgentActor => ({
    kind: "agent",
    agentId: `agent_${human.userId}`,
    name: `${human.name}'s Agent`,
    ownerUserId: human.userId,
    grant: { scope },
  });
  return { human, makeAgent };
}
