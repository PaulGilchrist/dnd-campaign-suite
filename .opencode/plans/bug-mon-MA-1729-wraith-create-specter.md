# Bug — MA-1729 Wraith Create Specter: monster-spawn summoning unmodeled for this row (row inert, zero affordance)

- ID: MA-1729 · stableKey wraith|actions|1 · category actions · actionType other
- Verified: 2026-09-30 · campaign test-campaign (locked) · dev :5173/:80
- Verdict: **FAIL(b)/DESIGN-GAP** — zero affordance, zero row-specific producer/consumer.

## Expected (row verbatim, disk wins)
"The wraith targets a Humanoid corpse within 10 feet of itself that has been dead for no longer than 1 minute. The target's spirit rises as a Specter in the space of its corpse or in the nearest unoccupied space. The specter is under the wraith's control. The wraith can have no more than seven specters under its control at a time."
A GM pressing this action should be able to spawn a Specter combatant under the wraith's control (advisory-grade), with corpse eligibility / 1-minute age / seven-specter cap surfaced as GM-adjudicated residuals.

## Actual
- Disk `wraith.actions[1]` = `{name, description}` ONLY — no automation, no numeric fields (§60 inert fingerprint).
- Live: `.mc-overlay` on Wraith 1's turn renders the row as `<div class="mc-action"><strong>Create Specter.</strong><span>…prose…</span></div>` — **0 clickable affordances** (no mc-dice-link, no role=button; overlay's 8 affordances all belong to other rows, e.g. Life Drain's attack chip).
- Nothing to click → zero popup, zero log delta (log: 3 entries, 0 specter-related), zero new combatants (16 cs creatures, `specter present: False`).

## Grep citations
- `grep -rni "createspecter|create_specter|spawnSpecter|specter.*spawn" src/ server/` (non-test) → **zero hits**: no named producer/consumer app-wide.
- `grep -n "summon" public/data/monsters.json` → seven `monster_summon` rows at lines 19249, 19403, 20002, 24425, 24541, 43553, 61377 (Drow Mage, Drow Priestess, Dust Mephit, Galeb Duhr, Galib Duhr, Myconid Sovereign, Treant). The wraith row is NOT one of them.
- FRAME CORRECTION (grep beats orchestrator quote): "the ONLY summon lane app-wide is player-spell summon_spirit (§86)" is FALSE — a live monster-side lane exists: `src/services/encounters/monsterSummon.js:43` `isMonsterSummonRow` → `src/components/encounter/MonsterAction.jsx:229` `SummonLink` chip → coin-flip/uses/recharge gates → combatSummary spawn + te "summoned" + logs (MA-0648/0651/0664/0757/MA-1215 lineage).
- Corpse state ("Humanoid corpse within 10 ft, dead ≤1 minute") has **no app representation** — no corpse tokens, no age clock (§70 family). Seven-specter cap has **no counter consumer** (grep "seven|summonCap|max_summons" in lane → zero) even for the 7 rows that DO summon.
- Precedent byte-twin: Myconid Sovereign "Animating Spores" (MA-1215) is the same corpse-rise family — authors `monster_summon` + `advisory` string carrying the corpse-eligibility/clock prose verbatim, GM-adjudicated.

## Likely Location
Design gap, honestly split: (1) SPAWN layer is NOT a missing-primitive gap — the existing `monster_summon` lane could arm this row today with `automation:{type:"monster_summon", options:[{monster:"specter"}], range_ft:10, advisory:"Corpse must be a Humanoid dead ≤1 minute; seven-specter control cap is GM-adjudicated (§70)."}` — this is NOT merely a one-field numeric fix like MA-1728's rider key, but it is an authored-data fix on an existing live seam. (2) FULL RAW fidelity (corpse token/state model, 1-minute corpse-age clock, ownership "under the wraith's control", per-summoner seven-cap counter) is a genuine app-wide DESIGN-GAP with no consumer code.

## Notes — §70 accepted-residual candidate, flagged for GM adjudication
Recommend: **accept-as-advisory** — author the advisory-grade monster_summon automation for wraith.actions[1] (spawn Specter ally of the wraith right after it, advisory text carrying corpse eligibility + seven-cap clocks verbatim, byte-twin of MA-1215 shape); OR ticket the corpse-state model if RAW enforcement is wanted. GM to choose.

## Evidence
- .opencode/plans/ma-1729-board-before-wraith-card.png (board after join)
- .opencode/plans/ma-1729-board-wraith-turn.png (turn = Wraith 1)
- .opencode/plans/ma-1729-wraith-overlay-create-specter.png + ma-1729-create-specter-row-zero-affordance.png (card open, row prose-only)
- .opencode/plans/checkpoint-mon-MA-1729.md (full probe record)
Manifest `docs/monster-actions-manifest.json` and monsters.json untouched by this run.
