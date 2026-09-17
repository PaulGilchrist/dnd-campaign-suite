# BUG — MA-0334 Balor Flame Whip: Prone + Pull-on-hit clauses INERT

## Verdict: FAIL (2026-09-17)

## Row
- MA-0334 | balor | actionIndex 1 | Flame Whip | attack
- attack_bonus 14, reach 30 ft, primary "3d6 + 8" Force + secondary "5d6" Fire.

## Disk key dump (public/data/monsters.json balor.actions[1])
- Keys present: `name`, `description`, `attack_bonus`, `reach`, `damage_dice_primary`, `damage_type_primary`, `damage_dice_secondary`, `damage_type_secondary`.
- **NO `conditions` key. NO `hit_conditions` key. NO `escape_dc`. NO `hit_target_effect`.**
- Prone + "pulls the target up to 25 feet straight toward itself" (Huge or smaller) is PROSE-ONLY inside `description`.

## Root cause
- `buildHitConditionClause` (`src/components/encounter/MonsterCardHelpers.js:382-388`) consumes ONLY `action.hit_conditions` (+ `escape_dc`); returns null otherwise. Plain prose / plain `conditions:[]` NOT consumed (MonsterCardModal.jsx:543 sole consumer).
- Balor Flame Whip authors neither key → named Prone clause never granted on hit.
- Pull movement: no monster-pull/movement subsystem exists (grapple-seam family MA-0287/MA-0288) → inert by architecture; cited, not probed.
- MA-0320 identical structure (dual damage + prose-only named condition) = FAIL bar precedent; MA-0291 not-authored-hit_conditions bar.
- Registry MA-0333 PASS already noted pull/prone clauses NOT granted (subsystem caveat).

## Live proof (test-campaign, header verified twice; Balor 1 via EB exact "Balor" Join; ElderPaladin Medium AC19, 224/224, armed target curl-verified `Balor 1 -> target: ElderPaladin`)
- 3 standalone Flame Whip "+14" chip clicks on open card modal, full popup cycles (Done=`dice-roll-reroll-btn`, stage-2 overlay click-dismiss):
  1. nat13+14=27 HIT vs AC19: 3d6[5,3,5]+8=**21 Force** + 5d6[3,5,2,4,1]=**15 Fire** = 36; EP 224→188 Δ-36 ✓
  2. nat6+14=20 HIT vs AC19: 3d6[3,1,6]+8=18 Force + 5d6[1,2,5,1,6]=15 Fire = 33; EP 188→155 Δ-33 ✓
  3. nat15+14=29 HIT vs AC19: 3d6[2,4,1]+8=15 Force + 5d6[1,2,2,3,3]=11 Fire = 26; EP 155→129 Δ-26 ✓
- Distinct d20s 13/6/15 — no MA-0273 cached-dice replay.
- **Prone/pull inert null-proof (post-3-hits curl cs truth, ElderPaladin):**
  - `activeConditions` ABSENT, `activeConditionMeta` ABSENT, `targetEffects` ABSENT
  - `escape_dc`/`escapeDc` ABSENT, `pendingExpirations` = `[]`
  - `position`/`speed` ABSENT — no pull/move state anywhere in cs.
- Log audit: 11 entries = encounter joined + initiative + 3 attack + 3 damage + 3 hp_change; **ZERO condition/prone entries, ZERO pull/move entries** — prose clause never adjudicated.

## Notes (damage core exact — NOT part of the fail)
- Dual damage exact every hit: formula "3d6 + 8" Force logged; Fire leg in hp_change `damageBreakdown [Force, Fire] resisted:false`; total==|hpΔ| chain 224→188→155→129 (Σ95) exact.
- Fire leg ≥1 fresh roll confirmed standalone chip live (all 3 rolls fire-damaged: 15/15/11).
- 2× damage core exactness already established MA-0333 — cited.
- Attack-roll logs display surplus second die ([13,17]/[6,14]/[15,15], first die authoritative) — app-wide cosmetic family (MA-0320 note).

## Fix
Add to balor.actions[1] in monsters.json: `"hit_conditions": ["prone"]` (MA-0010 seam; no escape_dc — Prone ends by standing, no save-escape authored here). Pull 25 ft requires a monster-pull movement subsystem (MA-0287/0288 family gap) — separate engineering. Then re-verify MA-0334.

## Cleanup
- Admin Clear Change Data + Clear Campaign Log, native confirms named "test-campaign" → curl `{}` / `[]` (see below).
- page.url() localhost:5173 throughout; off-localhost proxy-URL noise in tool echoes ignored; curl READ localhost:80 sole truth. No monsters.json/manifest/registry edits; no git mutating commands.
