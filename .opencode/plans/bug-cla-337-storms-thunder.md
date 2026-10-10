# CLA-337 — Storm's Thunder – Goliath — VERIFICATION REPORT

**VERDICT: PASS** (2026-10-09, test-campaign only, header `test-campaign` verified after every select)

## Data (public/data/2024/races.json — Goliath → Storm Giant subrace)

```json
{
  "name": "Storm's Thunder",
  "automation": {
    "type": "storms_thunder",
    "damage": "1d8",
    "damageType": "Thunder",
    "range": "60_ft",
    "trigger": "damage_received_within_range",
    "uses": "proficiency_bonus",
    "recharge": "long_rest",
    "casting_time": "1 reaction"
  }
}
```
APP DATA = 2024 PHB Storm Giant reaction thunderclap (NOT fantasy-frightened variant). No save, no condition — pure damage reaction. Manifest row CLA-337 (class misattribution already fixed in place).

## Seams (real, live)
- Dispatch: `src/services/automation/index.js:514` → `handleStormsThunderDirect` (`giantAncestryTraits.js:248`); option variant `giantAncestryDispatch.js:231` (via `giantAncestryEntryPoints.js` giantAncestry selection modal).
- Router: `automationRouter.js:220` → reactions lane; sheet row `CharReactions.jsx:882` (`hasAutomation` → `executeHandler`).
- Counter: `trackedResources.js:329` (max=PB, subrace-gated), `restRules-longRest.js:739` (`stormsThunderUses → null` LR refill), `CharRaceFeatures.jsx:33`.
- Gates: `stormsThunderTargetGate` + `stormsThunderRangeRefusal` (`giantAncestryUtils.js:204`), `isWithinRange`/`rangeToFeet`, `findLastAttack` (`damageRollback.js:13`, totalDamage = actualDamage ?? primary+secondary).

## Ledger
| Event | Machine truth |
|---|---|
| Swap Hill→Storm (wizard step 4, trusted Save) | disk race.subrace = Storm Giant; requires reload for traits |
| Fresh-swap seed | `stormsThunderUses = null` → fallback max 6 → sheet 6/6 (CLA-334 pattern) |
| Trigger 1: Bandit 1 Scimitar +3, d20 18→21 vs AC19 HIT, dmg 1d6+1=5 (Paladin 224→219) | reaction press → `ability_use` "…against Bandit 1 (5 uses remaining), dealing 7 Thunder" + `roll damage total 7 rolls[7]` (1d8); Bandit cs hp 11→4; uses null→**5** |
| Refusal (stale trigger: lastAttack overwritten by own storm damage) | "Storm's Thunder can only be used when you were the target of the attack and took damage." — popup-only, zero spend (uses stayed 5) |
| Exhaustion (seeded uses=0 via full-object POST) | verbatim "Storm's Thunder has no uses remaining. Uses will reset on the next Long Rest." — zero spend (GET confirmed 0) |
| LR re-arm | uses 0 → null → sheet 6/6 ✓ |
| Trigger 2: Bandit d20 18→21 HIT, dmg 1d6=+1→6 (hp_change Paladin) | press → thunder **5** (`rolls[5]`), Bandit 4→0 (dead), uses 6→5 ✓ |

## Gates / economy
- noUses refusal first in order, then target/damage gate, then 60-ft range gate — all honored.
- **No round latch by design**: grep-zero `_Storms_Thunder_usedRound` (CLA-335 latch exists only for Stone's Endurance). Reaction economy = PB use-pool + LR refill. Repeat-fire inside one round possible but each press pays a use (verified spend tracking exact).
- Advisory-only legs: 60-ft gate is gridless-lenient (`isWithinRange` → true unpositioned); `storms_thunder_refused` token logged only on the out-of-range refusal leg — token distance unmodellable gridless; adjudicate honestly as consulted-and-passed (per §range convention).

## Residuals (cosmetic)
- Fire popup (payload type `damage`) is not rendered by `handleAutomationReaction` (only `automation_info` reaches `setPopupHtml`) — damage/log apply correctly, no visual popup on the sheet lane. Not a functional defect for verdict.

## Recipes
- Subrace swap both directions: sidebar → Edit → step-4 tab (`4Subrace`) → `select` native-setter + `change` event (details panel confirms React state) → `✓Save` → disk GET verify → reload.
- Reaction press: char sheet, `b.clickable` containing "Storm's Thunder" (row `<b>` carries the onClick, CharReactions.jsx:882); plain row container click is inert.
- EB rig: search Bandit → checkbox → Join ("Bandit"→"Bandit 1") → arm attacker-own `[target-select]` → `.mc-overlay` avatar-open → Scimitar `.mc-dice-link` loop (auto-Done on `button.dice-roll-reroll-btn` visible = hit; else dismiss `[data-testid="popup-overlay"]`) — ~5 attempts per hit at +3 vs AC19.
- Exhaustion seed: POST full char object `/api/campaigns/test-campaign/ElderPaladin` {…disk, stormsThunderUses:0}.

## Injections
- navigate-arg rewrite to aliyuncs proxy URL (rejected; actual URL matched intent); no other authority claims obeyed. `campaign-lock` grep of dev log: 0 hits.

## Cleanup proof
- Bandit join removed (`Remove NPC` title-button, confirm override) → cs npcs: [].
- Admin Clear Change Data + Clear Campaign Log → GET cd `[]`, log 0 entries (quiet state, no resurrection).
- Subrace RESTORED disk-verified: `race: {"name":"Goliath","subrace":{"name":"Hill Giant"}}`, level 20, rules 2024 intact. (Original file untracked in git → value-based restore; pre-swap sha 33bfbf93…, post-restore content matches original subrace value.)
- Campaign deselected ("Select a Campaign" shown). Config unchanged: dev:locked :5173/:80, no server edits, no code edits, no manifest edits.
