# bug-mon-MA-0407 — Blob of Annihilation / Grasping Glob legendary row: zero-affordance inert alias, no forward to live DC23 DEX save, cooldown unenforced

- **Row**: MA-0407 | Blob of Annihilation (monsterIndex `blob-of-annihilation`) | category `legendary_actions` | actionIndex 2 | actionName `Grasping Glob` | actionType `other`
- **Rules text**: "The blob uses Restraining Glob. The blob can't take this action again until the start of its next turn."
- **Verdict**: **FAIL** — zero-affordance inert alias (MA-0376 class). Row renders pure prose; no forward to the live Restraining Glob save; advertised cooldown has nothing to enforce.

## Data keys dump (monsters.json legendary_actions[2])
- Only keys: `name`, `description`. NO `save_dc`, NO `attack_bonus`, NO `damage_dice_primary`, NO usage/cooldown structure.
- Real Restraining Glob exists separately at `actions[3]`: `save_dc: 23`, `save_type: dexterity`, dice `3d6 + 8`.

## Environment / repro
- http://localhost:5173, campaign `test-campaign` (header verified), GM localhost.
- Fresh start: Admin → Clear Change Data + Clear Campaign Log (native confirms both named "test-campaign"); cs `{}` / log `[]` verified via curl before test.
- EB search "Blob of Annihilation" exact (CR 23) → checkbox → Join Encounter.
- cs post-join: `activeCreatureName: "Blob of Annihilation 1"`, round 1, all `targetName: null`.
- Armed blob target combobox → HexWarlock; cs `targetName: "HexWarlock"` verified.
- Blob card opened via initiative-row avatar.

## Live evidence — affordance dump
- Grasping Glob legendary row DOM (exact): `<div class="mc-action "><strong>Grasping Glob.</strong> <span>The blob uses Restraining Glob. …</span></div>`
- `querySelectorAll('button,[role="button"],.mc-dice-link')` inside row = **0**. No dice chip, no "DC 23 Dexterity" chip, no "Expend Legendary" chip, no forward-link of any kind.
- Contrast (same card): Actions-section Restraining Glob row renders live `button "3d6 + 8"` + `button "DC 23 Dexterity"`; Engulf renders `6d6` + `DC 23 Strength`. The save affordance EXISTS one section up — the legendary alias simply never routes to it.
- No grep hits for "Grasping Glob"/"Restraining Glob" anywhere in `src/` — no forwarding seam exists in code.

## Forced clicks ×2 null-proofs
- Two programmatic `click()` dispatches on the row: **nothing**. No popup rendered, no save prompt, no log rows added (full log after clicks = 2 rows, both pre-click join-time: `encounter|joined` + blob `initiative` roll), no cs change beyond the `combat-ui-viewingMonster*` modal-open keys.
- cs spend/cooldown keys: **absent** — no `monsterLegendaryUses`, no `monsterLegendaryActionCooldowns`, no `lastAttack`, no HP deltas. Advertised cooldown ("can't take this action again until the start of its next turn") trivially unenforced: nothing fires, so nothing can refuse.

## Root cause (code trace)
1. `legendaryHeaderAction()` (`src/services/encounters/monsterLegendaryUses.js:153`) requires `rows[0].uses != null`; blob header row has no `uses` → header `null` (MA-0405 root) → `MonsterCardBody.jsx:55` ternary takes the UNGATED branch → `legendaryGate={handleLegendaryRow}` is never passed to the legendary section.
2. `MonsterAction.jsx` `LegendarySpendLink` returns `null` when `!legendaryGate` — so even the generic "Expend Legendary" fallback chip (which WOULD appear for a numeric-less legendary row in a gated monster) is unreachable here.
3. With no gate and no numeric fields: `ActionDamageLinks` null (no dice), `ActionSaveRoll` null (`save_dc == null`), not spellcasting, no gated-reaction match → row renders inert prose only. Classic MA-0376 zero-affordance class, compounded by MA-0405 dead economy and MA-0406 ungated-section context.

## Gaps (honest)
- **Forward gap**: "uses Restraining Glob" does not forward to the live actions[3] save seam (DC23 DEX, 3d6+8) even though that seam exists and works in the same card.
- **Spend gap**: no legendary use could be spent even if clicked — header economy dead (MA-0405).
- **Cooldown gap**: MA-0073 `monsterLegendaryActionCooldowns` infra matches the row's cooldown prose regex but lives inside unreachable `expendLegendaryUse` — unenforced, unreachable.
- No negative confirmation possible: row has zero clickable nodes, so refusal behavior is moot rather than tested-refused.

## Fix suggestion (not applied — no edits per row rules)
Fixing MA-0405 (parse `Legendary Action Uses: N` count from header name) would mount the gate and give this row at least a generic "Expend Legendary" spend chip with the MA-0073 cooldown latch. A fuller fix additionally resolves "uses X" alias prose to the monster's own action row X and forwards the click to that action's live save seam (DC23 DEX, 3d6+8) after spending.

CLEANUP: final Admin clears done (native confirms named "test-campaign"); cs `{}`, log `[]` verified via curl.

VERIFIED: FAIL
