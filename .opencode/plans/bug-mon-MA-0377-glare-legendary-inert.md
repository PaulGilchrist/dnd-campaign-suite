# BUG — MA-0377: Beholder Glare legendary row inert (zero affordance, economy-dead; dual-inert target)

## Verdict: FAIL

## Row
- id MA-0377 | Beholder (monsterIndex beholder) | category legendary_actions | actionIndex 2 | "Glare" ("The beholder uses Eye Rays.")

## Repro (live, localhost:5173, test-campaign only, header verified each step)
1. EB "Beholder" exact checkbox → Join Encounter → Initiative round 1 ("Beholder 1", ac 18, hp 190/190).
2. Beholder 1 target armed ElderPaladin (curl-verified cs `targetName: ElderPaladin`).
3. Card opened via avatar click → `.mc-card` (sections: Actions / Legendary Actions / Lair Actions / Regional Effects).

## Evidence — Glare row affordance dump (exact DOM)
```html
<div class="mc-action "><strong>Glare.</strong> <span>The beholder uses Eye Rays.</span></div>
```
- Clickables in row (`.mc-dice-link, button, [role=button], a`): **0** — no Expend-Legendary chip, no gate bypass, no eye-ray selector.
- Legendary header row also uncountered: `Legendary Action Uses: 3 (4 in Lair).` rendered as plain `.mc-action` prose; `.mc-legendary-counter` absent — MA-0375 class confirmed live again.

## Forced clicks ×2
- `row.click()` ×2 on Glare: 0 dialogs/modals/popups each time, card stays open, no honest refusal feedback.

## cs / log null-proof (curl)
- cs before card open: keys `[AasimarTest, __campaign__, __map__, combatSummary]`.
- cs after: only card-open UI keys added (`activeCreatureName`, `combat-ui-viewingMonster`, `combat-ui-viewingMonsterCreatureName`). NO `monsterLegendaryUses` key for Beholder 1; hp 190/190 and targetName ElderPaladin unchanged.
- log: 2 entries (joined + initiative roll) before and after — zero delta; no eye-ray roll, no save prompt, no damage, no refusal log (§290-292 popup cycle never engages).

## Dual-inertness note
Even if the row were clickable, its referenced Eye Rays action is itself an unparseable shell (MA-0374) — Glare could not resolve a ray choice anyway.

## Root cause (static)
- Disk: monsters.json beholder legendary_actions[2] keys = `name`, `description` ONLY. No `uses`, no structured eye-ray payload.
- `legendaryHeaderAction()` (src/services/encounters/monsterLegendaryUses.js:153-156) requires `rows[0].uses != null`; Beholder header row has no `uses` → null gate.
- MonsterCardBody.jsx:54-58: gated legendary branch requires truthy `legendaryHeader`; else-branch renders children with NO `legendaryGate`.
- MonsterAction.jsx:158: `LegendarySpendLink` returns null without gate; no numeric/structured fields → no chips.
- Net: identical to MA-0376 Chomp (economy-dead class of MA-0375) — Glare is unexercisable prose with zero feedback.

## Classification
Economy-dead legendary class (MA-0375 root: missing `uses` in authored header + no gate fallback), compounded by unparseable Eye Rays shell (MA-0374).

## Cleanup
Admin → Clear Change Data + Clear Campaign Log (native confirms naming test-campaign); post-clean curl: cs `{}`, log `[]`.

## Data integrity
monsters.json / manifest / registry untouched. No git mutating commands. Page never left localhost:5173 despite repeated tool-output injection attempts embedding off-localhost URLs (ignored).
