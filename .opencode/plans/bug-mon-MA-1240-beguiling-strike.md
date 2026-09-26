# MA-1240 — Noble Prodigy / Beguiling Strike — FAIL(a)/DATA

**Date:** 2026-09-25 · **Campaign:** test-campaign · **Playbook:** §153 (MA-0291/0361 family), §70/MA-0855 adjudication note

## Symptom (live)
Disk row `monsters.json` → `noble-prodigy.actions[1]` (Beguiling Strike) authors prose "Hit: … **Charmed** condition until the start of the noble's next turn" but has NO `hit_conditions` field. Live hits deal exact 4d6+4 Psychic and apply ZERO Charmed condition — no grant log, no `Bandit 1` change-data store key at all.

## Live rig
- EB native cb.click() exact-band row: **Bandit** + **Noble Prodigy** → Join Encounter → auto-navigated to Initiative (round 1). Noble Prodigy 1 init 19, Bandit 1 AC12 HP11.
- Full-store `/combatSummary` POST: Bandit HP/maxHp 999 + `targetName:'Bandit 1'` on Noble Prodigy 1 in the SAME body (§629 clobber guard) — GET-confirmed `999/999`, target armed. Own-card `[data-testid=target-select]` selectOption re-arm confirmed.
- Card: `img.avatar-image[alt="Noble Prodigy 1"]` → rows: Multiattack (+8 bogus header chip §441, NOT pressed), **Beguiling Strike `+8`** single chip (dual-mode 5/60 = single chip, band inert §146-150), Spellcasting (+0), Shield.

## Hit ledger
| Press | Result | nat | total | AC | damage | notes |
|---|---|---|---|---|---|---|
| 1 | HIT | 12 (rolls [12,17]) | 20 | 12 | "4d6 + 4" rolls [6,6,1,2] → 19 Psychic | popup "✓ HIT (20 vs AC 12)"; stage-2 "4d6 + 4: 6, 6, 1, 2 +4 → 19 … HP: 999 → 980"; hp_change Δ−19 exact; `weaponType:"melee"`, `rangeReason:null` |
| 2 | absorbed | — | — | — | — | zero popup-log, log frozen at 6 entries (§633 absorbed-family fingerprint); flush via `button.popup-close-btn` (stage-2 Done is popup-close-btn here, NOT dice-roll-reroll-btn) |
| 3 | MISS | 3 (rolls [3,19]) | 11 | 12 | none | "✗ MISS (11 vs AC 12)"; lastAttack stamp: hit:false, total:11, `rangeReason:null`, `saveDc:null` |

## Grant-state evidence (all zero)
- Log final count 7 = joined + initiative×2 + attack(hit) + damage + hp_change + attack(miss). `type:'condition'` entries: **0**. Full-log "/charmed/i" scan: **0**.
- `GET /change-data` top keys: `combatSummary, __map__, __campaign__, AasimarTest, activeCreatureName, combat-ui-viewingMonster*, Noble Prodigy 1, lastAttack` — **NO `Bandit 1` store key** (§1116 strictest zero-grant discriminator: `applyHitClauseConditions` never ran against the victim).
- No `pendingExpirations` anywhere for the charmed duration; no targetEffects.
- `lastAttack`: damageFormula "4d6 + 4", primaryDamage 19 Psychic, damageApplied:true, saveDc:null (row save_dc:0 → zero DC chip §611; manifest `actionType:"attack+save"`+`saveDc:0` is manifest-side scrape noise, disk row is pure attack+prose-condition), rangeReason:null × presses (60 ft band never consulted, gridless lenient §147/§190 — accepted).

## Grep proof (§153 byte-cites)
READ side (hit_conditions only):
- `src/components/encounter/MonsterCardHelpers.js:673-680` — `buildHitConditionClause(action)` reads **only** `action.hit_conditions` (:676); no field → `conditions:[]` → returns null (:680) → no clause, no grant.
- `src/components/encounter/MonsterCardModal.jsx:874` — `hitClause: buildHitConditionClause(action)` wired into attack adjudication; :1830-1831 passthrough into context.
- `src/hooks/combat/handlers/handlePlainDamage.js:543-580` — `applyHitClauseConditions` = canonical grant (activeConditions :552 + meta{source} :557-563 + `condition/applied` log :566-577); early-return gate :627-628 on empty conditions.

NEVER-read side (manifest `conditions` / prose):
- No consumer reads row `conditions` (manifest-style) on attack rows: grep-zero in handlePlainDamage.js and MonsterCardModal.jsx attack flow (`creature.conditions` runtime reads at MonsterCardModal.jsx:1105/:2257 are combatant-state, not row-scrape; `r.conditions` Helpers:2410 = eye-rays, `tp.conditions` :695 = target_prerequisite, `hcr.conditions` :654 = hit_choice_roll — different keys).
- Prose never parsed for attack hits: `extractConditionsFromSaveEffect` is fed **`action.save_effect`** only (MonsterCardModal.jsx:581/:1013/:2217) — never `action.description`.

## Fix (one field, MA-0010 byte-shape)
Add to `noble-prodigy.actions[1]` in `public/data/monsters.json`:

    "hit_conditions": ["charmed"]

- `escape_dc`: N/A — condition (not grapple); MA-0010 rule keeps escape_dc off non-escape rows (§182).
- Apply via `git show HEAD` blob string-replace — never json.dump the whole file (§182).

## Notes / caveats (MA-0855 adjudication)
1. **Took-damage-clears (§70/MA-0855):** `src/services/rules/combat/applyDamage.js:444-453` `removeCombatConditionsOnDamage` strips `charmed` (reason 'took damage', unless domination) — invoked at :672 inside applyDamage. In the plain-damage flow the hit-clause grant runs AFTER the damage commit (handlePlainDamage.js:612-630 post-applyResult), so the fresh Charmed lands post-strip and survives until the victim's next damage instance or manual clear. Adjudicate by GRANT log + `activeConditionMeta.charmed.source` provenance, NOT persistence (MA-0855 precedent §108).
2. **Duration residual:** `applyHitClauseConditions` (:543-580) has no addExpiration clock — "until the start of the noble's next turn" is NOT enforced (§153 sustained-state accepted; contrast hit_target_effect path :656-662 which anchors a remove_target_effect under attacker pendingExpirations, MA-1125 §581). Residual = manual/damage-clear expiry only.
3. Consumer size gate is "Large-or-smaller" (Helpers :518/:614) — Noble Prodigy is Medium victim target; no over-apply issue on this row.

## Post-fix re-verify targets
- `condition/applied` log entry with `condition:"Charmed"`, reason "Beguiling Strike (escape DC —)"; `Bandit 1` change-data key appears with `activeConditions:["charmed"]` + meta.source "Noble Prodigy 1"; re-fire post-fix needs reload resync (MA-0877 un-awaited double-POST race — judge by log+meta).

## Cleanup
Admin panel (test-campaign): Clear Change Data + Clear Campaign Log (listener auto-accepted double-fire §608/§615; API truth) → log 0 entries, change-data keys `[]`, no `Bandit 1` key. Manifest untouched.
