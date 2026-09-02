import { RELAY_TOOL_SCOPES, READ_ONLY_TOOL_NAMES } from "../src/shared/tool-scopes.js";
import { UI_MUTATING_ACTIONS } from "../src/shared/ui-actions.js";

/**
 * Enforces Relay's core claim: every mutating capability in the tool
 * surface has a matching UI control, and every UI control has a matching
 * tool with identical authority. Run via `pnpm --filter relay test:parity`;
 * wired into `pnpm build` so a new mutating tool without a UI action (or
 * vice versa) fails CI, not just a manual review.
 */
function main(): void {
  const readOnly = new Set<string>(READ_ONLY_TOOL_NAMES);
  const allToolNames = Object.keys(RELAY_TOOL_SCOPES);
  const mutatingToolNames = new Set(allToolNames.filter((name) => !readOnly.has(name)));
  const uiActions = new Set<string>(UI_MUTATING_ACTIONS);

  const toolsWithoutUiAction = [...mutatingToolNames].filter((name) => !uiActions.has(name));
  const uiActionsWithoutTool = [...uiActions].filter((name) => !mutatingToolNames.has(name));

  if (toolsWithoutUiAction.length > 0 || uiActionsWithoutTool.length > 0) {
    if (toolsWithoutUiAction.length > 0) {
      console.error("Mutating tools with no matching UI action:", toolsWithoutUiAction);
    }
    if (uiActionsWithoutTool.length > 0) {
      console.error("UI actions with no matching mutating tool:", uiActionsWithoutTool);
    }
    process.exit(1);
  }

  console.log(`Tool/UI parity OK — ${mutatingToolNames.size} mutating tools, all paired with a UI action.`);
}

main();
