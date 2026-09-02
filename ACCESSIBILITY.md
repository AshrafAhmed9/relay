# Accessibility audit — Cadence, Consequence, Relay

Code-level review (not a screen-reader session) against WCAG 2.2 AA, done 2 Sep 2026. Two real bugs found and fixed; the rest is a status check against what the READMEs already claim.

## Fixed this pass

1. **Keyboard activation incomplete on custom buttons (WCAG 2.1.1 Keyboard).** `IssueCard` (Cadence) and both nav items in `SectionNav` (Consequence) used `role="button"` with `onKeyDown` that only handled `Enter`. Per the WAI-ARIA Authoring Practices, a custom button must activate on both Enter and Space — these only worked with Enter, so a keyboard-only or switch-device user pressing Space (the more common expectation for buttons) got nothing. Fixed in `IssueCard.tsx` and `SectionNav.tsx`.
2. **Confirmation dialogs had no Escape-to-dismiss (WCAG 2.1.1 / 3.2.1).** `ConfirmDialog` in all three apps let you approve or decline by clicking, but had no keyboard escape hatch — `CommandPalette` (Cadence) already handled Escape, `ConfirmDialog` didn't. Added an `onKeyDown` handler resolving `false` (decline) on Escape, in all three apps' `ConfirmDialog.tsx`.

## Verified as already correct

- Live regions: the activity feed in all three apps is `aria-live="polite"` with a label, so tool-call updates are announced without stealing focus.
- Modal/dialog semantics: `role="dialog"`/`role="alertdialog"` with `aria-modal="true"` and a descriptive `aria-label` present on the command palette, issue detail panel, and all confirm dialogs.
- Form labeling: Cadence's issue-detail fields (`status-select`, `priority-select`, `estimate-input`) use `<label htmlFor>` correctly paired with element `id`s. Consequence's `FieldRow` does the same for all ~63 form fields.
- Relay's schedule table is a real `<table>` with `<th scope="col">` on every column header, not a div-grid — genuinely screen-reader-navigable, matching the README's claim.
- Focus is set on dialog open (`autoFocus` on the primary action) in all `ConfirmDialog` instances and the command palette's search input.
- Checkbox/button elements throughout carry specific `aria-label`s (e.g. "Select CAD-142 for bulk update") rather than relying on visual-only context.

## Not fixed this pass — real gaps, lower severity

- **No focus trap in modals (WCAG 2.4.3 Focus Order).** `ConfirmDialog` and `CommandPalette` set initial focus correctly but don't trap Tab within the dialog, so repeated Tabbing can reach the page behind the backdrop while a modal is open. Worth a real fix (a small `useFocusTrap` hook shared across the three `ConfirmDialog`s) but out of scope for this pass given the deadline.
- **No `prefers-reduced-motion` check.** None of the three apps use non-essential animation currently (no transitions beyond `.tool-count` border-color and `filter: brightness` on hover), so this is low-risk, but worth a real audit pass before claiming full 2.2 AA rather than asserting it from a code read.
- **Not screen-reader tested.** Everything above is a static-analysis pass (grep for `aria-`/`role`/`tabIndex`/`<label>`/`scope=`, reading the actual JSX), not a real VoiceOver/NVDA session. The README's "known limitations" sections already say this plainly and shouldn't be upgraded to "audited" until someone actually runs one.

## Scope

Did not audit Board.tsx's drag interactions (Cadence doesn't implement drag-and-drop reordering per the seed comments — issues move via keyboard-operable status/priority controls, not drag, so this wasn't applicable) or color-contrast ratios pixel-by-pixel (the dark palettes use fairly high-contrast text tokens throughout, but contrast ratio wasn't independently measured against WCAG's 4.5:1 threshold).
