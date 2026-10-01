# BUG MA-1723 — Winter Wolf Bite — FAIL(a)/DATA (prone hit-rider free-text only, never lands)

**Date:** 2026-09-30
**Row:** MA-1723 Winter Wolf Bite (attack, category actions)
**Verdict:** FAIL(a)/DATA — hit rider "Prone" authored in prose ONLY; disk row lacks structured `hit_conditions`, so a confirmed hit applies damage but ZERO condition. One-field data fix (MA-1534/MA-1541 lane).

## Description (expected)
"Melee Attack Roll: +6, reach 5 ft. Hit: 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature, it has the Prone condition."
On a hit vs a Large-or-smaller target (Bandit = Medium ⇒ gate passes as-written), target gains **prone**.

## Disk shape (DISK WINS) — public/data/monsters.json winter-wolf actions[0]
```json
{ "name": "Bite",
  "description": "Melee Attack Roll: +6, reach 5 ft. Hit: 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature, it has the Prone condition.",
  "attack_bonus": 6,
  "reach": "5 ft.",
  "damage_dice_primary": "2d6 + 4",
  "damage_type_primary": "Piercing" }
```
`hit_conditions` ABSENT. Attack+damage legs exact vs manifest (6 / "2d6 + 4" / Piercing / 5 ft.) — the INERT rider is the sole defect.

## Grep proof — riders arm ONLY from the structured key (§MA-1541)
- `src/components/encounter/MonsterCardHelpers.js:874-877` — `hitClauseAutoGrantConditions`: `if (hitChoiceArmed(action) || !Array.isArray(action?.hit_conditions)) return [];` — no prose fallback.
- `src/components/encounter/MonsterCardHelpers.js:900-903` — `buildHitConditionClause`: conditions empty + no riders ⇒ **return null**.
- `src/components/encounter/MonsterCardModal.jsx:975` + `:1992-1993` — clause null ⇒ `context.hitClause` never set on the bite roll.
- `src/hooks/combat/useLoggedDiceRollAttack.js:208` — `hitClause: context?.hitClause || null` ⇒ null into damage resolution.
- `src/hooks/combat/handlers/handlePlainDamage.js:555` — `applyHitClauseConditions` (sole activeConditions+meta.source+condition-log write for hit-riders) unreachable ⇒ **zero prone delta on every hit**.
- Alt seam `handlePlainDamage.js:542-545` `maybeApplyRamProne` gated on `context.ramActive` (ram creatures) — Bite never sets it. No `hit_target_effect`/`hit_choice` riders on the row.

## Probe (vitest run of REAL consumer on disk rows — live-roll substitute; no browser tool this session)
`npx vitest run src/components/encounter/ma1723-probe.test.js` → 4/4 PASS (temp file removed):
1. winter-wolf Bite: `'hit_conditions' in action === false`
2. `buildHitConditionClause(winter-wolf Bite)` === **null** → prone NEVER lands (zero delta)
3. CONTROL stone-giant Boulder → `{ conditions:["prone"] }` armed (MA-1534 holder, disk-verified `hit_conditions:["prone"]`) — consumer lane LIVE ⇒ defect is DATA, not code
4. `rollExpression("2d6 + 4")` healthy (2 dice, totals 6..16)
- `grep -n hit_conditions public/data/monsters.json` → 97 holders (incl. MA-1541 storm-giant Thunderbolt `["blinded","deafened"]` fixed via the same one-field lane).

## Fix (one field) — MA-1534/MA-1541 precedent lane
Add to winter-wolf Bite row after `damage_type_primary`:
```json
"hit_conditions": ["prone"]
```
- Rides live lane: hitClauseAutoGrantConditions → buildHitConditionClause → modal context → applyHitClauseConditions (handlePlainDamage.js:555) — grants `prone` into victim `activeConditions`, stamps `activeConditionMeta.prone.source = "Winter Wolf 1"` (:567-574), emits condition log (:580-590). Identical shape to stone-giant Boulder (MA-1534 FIXED) and storm-giant Thunderbolt (§MA-1541 2026-09-29).
- "Large or smaller" size gate: app applies unconditionally (no target-size gate in applyHitClauseConditions) — Bandit/Medium passes as-written; gate remains advisory (§70).
- Plain `prone` has NO BADGE_SPECS board badge (§MA-1541 :1160) — verify grant via victim change-data `activeConditions` + meta + condition log, not badge count.
- No duration fields: §MA-1541 fixed-lane note — pure hit_conditions carries no expiration clock; prone persists until standings/ends-of-turn cleanup handle it; duration stays advisory unless `hit_target_effect` lane authored.

## Re-verify after fix
Live lane required once browser available: join Winter Wolf 1 + Bandit 1, AC 12, re-arm target each roll, hit ⇒ |hpΔ| == 2d6+4 roll AND `Bandit 1.activeConditions` contains `prone` + one condition log entry.

## State left at report time
test-campaign board EMPTY (GET change-data `{}`); board staging for MA-1724 blocked headlessly — MA-1724 run adds Winter Wolf 1 + 2 victims itself.

## Live confirmation (Playwright, 2026-09-30)
Browser run on dev:locked :5173/:80, board EMPTY before staging. Header verified `test-campaign` after every nav. EB search "Winter Wolf" → checkbox `Select Winter Wolf` [checked] → Join Encounter → Initiative round 1 shows **Winter Wolf 1** (HP 75/75, Init 7). Target added via `+ NPC`, renamed **Bandit 1**, GM-filled HP 999/999 (change-data shows `currentHp:999, maxHp:11` — display clamp; judged by hp_change log per protocol). AC 12, size Medium. Bite chip in `.mc-overlay` anchor `<strong>` = "Bite. +6Melee Attack Roll: +6, reach 5 ft. Hit: 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature…" — manifest text exact. Bandit 1 re-armed via wolf-row `[data-testid="target-select"]` selectOption before EVERY roll (value confirmed "Bandit 1").

### Rolls (3/3 hit; no nat-20 ⇒ no crit leg exercised)
| # | d20 | +6 | vs AC 12 | Damage popup (formula) | dice | total | hp_change log | Bandit activeConditions after |
|---|-----|----|----------|------------------------|------|-------|---------------|-------------------------------|
| 1 | 13 | 19 | HIT | "2d6 + 4" | [1,5] | 10 Piercing | −10 → 989 | absent (no prone) |
| 2 | 6 | 12 | HIT (meets AC) | "2d6 + 4" | [6,2] | 12 Piercing | −12 → 977 | absent (no prone) |
| 3 | 7 | 13 | HIT | "2d6 + 4" | [4,6] | 14 Piercing | −14 → 963 | absent (no prone) |

|hpΔ| == rolled total on every hit. Chip fires, dice exact.

### Prone probe
- Pre-roll change-data: `prone` appears ONLY inside `combat-ui-viewingMonster` free-text Bite description (1 mention).
- After hit 1 / hit 2 / hit 3: GET change-data each time — `prone` occurrences OUTSIDE the viewed-monster card blob: **0**. Bandit 1 `combatSummary` entry has NO `activeConditions` key at all (`activeConditions: None`).
- Campaign log: 11 entries total; `type:"condition"` entries: **[] (zero)**. Only roll(attack)/roll(damage)/hp_change for Bite — condition log never emitted.
- ⇒ LIVE CONFIRMED: prone rider inert exactly as static verdict predicted. FAIL(a)/DATA upheld; one-field fix `hit_conditions:["prone"]` remains the remedy.

Screenshots: ma1723-roll1-result.png / ma1723-roll2-result.png / ma1723-roll3-result.png (workspace).

## Cleanup (final Winter Wolf row)
Admin → Clear Change Data + Clear Campaign Log (native confirms accepted), polled 30 s — see checkpoint file for post-clear state.
