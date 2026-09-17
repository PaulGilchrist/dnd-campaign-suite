# BUG — MA-0376: Beholder Chomp legendary row inert (zero affordance, economy-dead)

## Verdict: FAIL

## Row
- id MA-0376 | Beholder (monsterIndex beholder) | category legendary_actions | actionIndex 1 | "Chomp" ("The beholder makes two Bite attacks.")

## Repro (live, localhost:5173, test-campaign only, header verified each step)
1. EB "Beholder" exact → Join Encounter → Initiative round 1 ("Beholder 1", ac 18, hp 190/190).
2. Beholder 1 target armed ElderPaladin (verified cs `targetName: ElderPaladin`).
3. Card opened via avatar click → .mc-card.

## Evidence — Chomp row affordance dump (exact DOM)
```html
<div class="mc-action"><strong>Chomp.</strong> <span>The beholder makes two Bite attacks.</span></div>
```
- Clickables in row (`.mc-dice-link, button, [role=button]`): **0** — no Expend-Legendary chip, no +8 attack chip, no gate bypass affordance.
- Legendary header row also uncountered/unaffordanced (no `mc-legendary-counter`): same MA-0375 class.
- Bite row above IS live (+8 chip), so the two-bite intent target exists — but the Chomp legendary row cannot trigger it.

## Forced clicks ×2
- `click({force:true})` ×2 on Chomp row: no popup, no dialog, card stays open.

## cs / log null-proof (curl)
- cs before: keys `[AasimarTest, __campaign__, __map__, activeCreatureName, combatSummary]`.
- cs after: only added `combat-ui-viewingMonster` / `combat-ui-viewingMonsterCreatureName` (card-open UI keys). NO `monsterLegendaryUses` key for Beholder 1. hp 190/190 unchanged, targetName unchanged.
- log: 2 entries before and after (joined + initiative) — zero delta, no bite rolls, no legendary refusal log/popup (contrast MA-0273-style honest refusal absent entirely).

## Root cause (static)
- Disk: monsters.json beholder legendary_actions[0] header has NO `uses` key (name/description only); Chomp row has only name/description — pure text, no attack_bonus/dice/save_dc.
- `legendaryHeaderAction()` (src/services/encounters/monsterLegendaryUses.js:153-156) returns rows[0] only when `rows[0].uses != null` → null for Beholder.
- MonsterCardBody.jsx:54-58: gated legendary branch requires truthy `legendaryHeader`; else-branch renders children with NO `legendaryGate`.
- MonsterAction.jsx:158: `LegendarySpendLink` returns null without gate; no numeric fields → no attack/save/damage chips.
- Net: entire Beholder legendary economy is dead prose — Chomp is unmuscible in either direction (no spend, no attack, no refusal feedback).

## Classification
Economy-dead class of MA-0375 (same root: missing `uses` in authored header + no gate fallback). Beholder's legendary_actions lack structured `uses`/`attack_bonus` data AND the UI offers no authored-text fallback gate or honest refusal.

## Data integrity
monsters.json / manifest / registry untouched. No git mutating commands.
