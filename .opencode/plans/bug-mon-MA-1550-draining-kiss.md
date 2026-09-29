# BUG MA-1550 — Succubus/Incubus "Draining Kiss" (save row): HP-max-reduce rider inert on both faces

**Verdict: FAIL** (sole violation: inert max-HP-reduce rider; half-on-success and DC math PASS)
**Row:** Succubus/Incubus / Draining Kiss / save, DC 15 Constitution, 5d10 + 5 Psychic, conditions [charmed], save_effect "32 (5d10 + 5) psychic damage. Success: Half damage." — NO `dc_success` field authored
**Date:** 2026-09-29 · E2E via Playwright on localhost:5173, test-campaign ONLY

## What failed

- **FAIL — HP-max-reduce rider inert on BOTH faces.** RAW "The target's hit point maximum is reduced by an amount equal to the damage taken… target dies if this reduces its max to 0." Live: Bandit 1 `maxHp` stayed **200** through every resolution on the clean board (fails −41/−39/−41, success −19). No `hp_max_reduce` targetEffect (`targetEffects: null` on the Bandit), no max-reduce badge, zero `hp_max_reduce` log entries across the whole run. The only death was ordinary current-HP depletion (MA-1547-style clamp case, see Notes).

## PASS-partial evidence (what IS correct — inside the bug)

- **Half-on-success WORKS here** (unlike MA-1547's full-on-success defect): no `dc_success` on the row → `buildSaveOptions` half-default (`src/components/encounter/MonsterCardModal.jsx:1141`: `dcSuccess: save_dc > 0 ? (action?.dc_success ?? 'half') : null`) fired live, MA-0963 precedent shape.
  - Success 1: raw 5d10+5 = 8,7,4,7,8 +5 = **39** → applied **19** = floor(39/2) exact (`save-damage` log: `finalDamage:19, saveSuccess:true`).
  - Success 2: raw 10,3,9,4,8 +5 = **39** → applied **19** exact; HP 79 → 60.
- **DC + type enforced honestly:** pressed the "DC 15 Constitution" chip (never the "5d10 + 5" dice chip, §986). Bandit save bonus displayed +0. All splits consistent: totals 4, 13, 11 → FAILURE; 16, 17 → SUCCESS. No total exactly 15 observed (nearest fail 13, nearest pass 16).
- **Failed-face damage math exact:** full 5d10 + 5 on all three clean failures — 41 (8,3,5,10,10,+5) HP 200→159; 39 (9,9,8,7,1,+5) 159→120; 41 (1,10,6,9,10,+5) 120→79. `hp_change` deltas match rolled totals exactly.

## Faces observed (popup + `hp_change` log, maxHp probed via `GET /api/campaigns/test-campaign/combatSummary`)

| # | Save (d20+0 vs DC 15) | dmg rolled 5d10+5 | applied | Bandit HP | Bandit maxHp |
|---|----------------------|-------------------|---------|-----------|--------------|
| 1 | **SUCCESS** 16 | 39 (8,7,4,7,8,+5) | **19 = floor(39/2) ✓** | 11→0 (dead — clamp artifact, see Notes) | **11 (expect ≤0-reduce) ✗** |
| — | — | — | — | re-baselined 200/200 via `POST combatSummary` | 200 |
| 2 | FAIL 4 | 41 (8,3,5,10,10,+5) | 41 full ✓ | 200→159 | **200 ✗** |
| 3 | FAIL 13 | 39 (9,9,8,7,1,+5) | 39 full ✓ | 159→120 | **200 ✗** |
| 4 | FAIL 11 | 41 (1,10,6,9,10,+5) | 41 full ✓ | 120→79 | **200 ✗** |
| 5 | **SUCCESS** 17 | 39 (10,3,9,4,8,+5) | **19 = floor(39/2) ✓** | 79→60 | **200 ✗** |

## Root-cause pointers (static)

- **Rider never authored:** the `succubus-incubus` Draining Kiss row in `public/data/monsters.json` carries only `save_dc`, `save_type`, `save_effect`, `damage_dice_primary`, `damage_type_primary`. No structured `hit_hp_max_reduce:{equal_to:"damage"}` key (compare specter Life Drain, MA-1489; `parseHitHpMaxReduce` in `src/components/encounter/MonsterCardHelpers.js:788`).
- **Seam is hit-path-only even if authored:** sole consumer is `handlePlainDamage.js:990` (`hitClause.hpMaxReduce`, attack-hit path). `src/hooks/combat/saveProcessing.js` and `src/hooks/combat/handlers/handleNpcSaveDamage.js` grep **clean** of any `hit_hp_max_reduce`/`hpMaxReduce`/`hp_max_reduce` consumption (rg zero matches). Save resolution cannot reach the rider. Fix mirrors MA-1489: author the key + a save-outcome consumer reducing max by `finalDamage` on BOTH faces (ledger + badge + `hp_max_reduce` log).

## Notes (not primary judgment)

- **Charmed-target RAW gate unenforced:** "kisses a creature charmed by it or a willing creature" — no `target_prerequisite` on the row; the kiss fired on an uncharmed Bandit every time (Charm itself broken per MA-1546, so nothing could be legitimately charmed).
- **Un-clamped HP probe artifact:** GM initiative current-HP input accepted 200 and the server reported `currentHp:200, maxHp:11`, but the save-damage apply path read old-HP clamped to `maxHp` (11), so face 1 killed the Bandit (popup "HP: 19 → 0", log `delta:-11, currentHp:0, maxHp:11`). Same non-persisting max-HP input quirk family as MA-1547 (`createCreatureHandlers.js:32` `delta===0` early-return). Clean 200/200 board was re-established via `POST /api/campaigns/test-campaign/combatSummary` (MA-1547 precedent) for faces 2–5.
- Popup shows save bonus "+0" while combatSummary `saveBonuses.con` is 1 for the Bandit — cosmetic honesty note only; verdict math unaffected (all totals judged vs displayed d20+0).

## Cleanup performed

Initiative cleared (monsters removed; player roster baseline remains), change-data cleared, campaign log cleared via Admin (test-campaign). Log verified `length:0`; combatSummary contains no monster entries.
