# Bug — MA-0366: Bearded Devil "Beard" Poisoned + no-heal clauses inert (prose-only, never land)

Verdict: **FAIL** (MA-0320 class — advertised, keys absent, never lands)
Date: 2026-09-17 | Campaign: test-campaign (header verified at every step; native confirms echoed `test-campaign`)

## Row
- MA-0366 | Bearded Devil (monsterIndex `bearded-devil`) | actions[1] `Beard` | attack
- +5 to hit | 1d8 + 3 Piercing | reach 5 ft | advertised: `poisoned` condition + prose "Poisoned until start of devil's next turn; until poison ends, target can't regain Hit Points."

## Evidence (runtime, localhost:5173, target ElderPaladin AC 19, HP 224/224 top)
EB "Bearded Devil" exact → Join → Initiative Target combobox armed; curl-verified cs `Bearded Devil 1` ac13 hp58/58 init8 `targetName: "ElderPaladin"`; sheet `Armor Class: 19`, `Hit Points: 224/224`.

Fired Beard "+5" own chip ×6 (full popup cycles §290-292; MA-0273 full dismiss both stages between rolls):
1. d20 nat 7 → 12 vs AC 19 → MISS (popup dismiss; log attack only, zero damage/hp_change)
2. d20 nat 12 → 17 vs AC 19 → MISS
3. d20 nat 20 → 25 vs AC 19 → **CRIT HIT** → damage popup `1d8 + 3: 1*2 +3` = **5** Piercing (crit dice doubled) → HP 224 → 219 (log hp_change −5)
4. d20 nat 10 → 15 vs AC 19 → MISS
5. d20 nat 2 → 7 vs AC 19 → MISS
6. d20 nat 15 → 20 vs AC 19 → **HIT** → damage popup `1d8 + 3: 7 +3` = **10** Piercing exact → HP 219 → 209 (log hp_change −10)

Nat dice fresh/distinct: 7 / 12 / 20 / 10 / 2 / 15 (vs prior MA-0365 set {16,17,7}).
Flip exact: nat≥14 hit / nat≤13 miss vs AC 19 with +5 (25, 20 hit; 7, 12, 15, 7 miss — nat 15→20 hit, nat≤13 all miss ✓).

## Post-hit probe (curl /api/campaigns/test-campaign/change-data — truth)
After 2 confirmed hits on ElderPaladin:
- `ElderPaladin.activeConditions`: **null**
- `ElderPaladin.activeConditionMeta`: **null**
- `ElderPaladin.statusEffects` / `targetEffects` / `poisoned` / `noHealing` / `no_healing` / `healingBlocked`: **null**
- `ElderPaladin.pendingExpirations`: **[]** — no "start of devil's next turn" expiry scheduled
- `escape_dc` / `escapeDc`: null
- Full-payload needles: `no_healing` ×0, `no-heal` ×0; `poison`/`Poison` occur ONLY in prose (action description, devil flavor text) and devil immunities lists — zero target state.
- `currentHitPoints` 209 (224 − 5 − 10) — damage pipeline correct; clause state absent.

## Disk keys dump — monsters.json actions[1] (READ only, not edited)
Keys: `name`, `description`, `attack_bonus`, `reach`, `damage_dice_primary`, `damage_type_primary`.
**Absent:** `hit_conditions`, `escape_dc`, `hit_target_effect`, `conditions` (structured). Poisoned + no-HP-regain exist solely as `<strong>Poisoned</strong>` prose in `description`.

## Grep — HP-regen-block / poisoned consumers
- No `noHealing` / `cantRegain` / `noRegain` / `preventHealing` / `hpRegenBlock` consumers anywhere in `src/` (×0 matches).
- `src/components/encounter/MonsterCardHelpers.js:382` `buildHitConditionClause` — clause ONLY if `hit_conditions` non-empty array or `hit_target_effect`; line 385 `return null` otherwise. Beard → **null clause** (MA-0320 fingerprint verbatim).
- `src/hooks/combat/handlers/handlePlainDamage.js:488` MA-0010 `applyHitClauseConditions` — gated on the null clause → never invoked for Beard.
- `src/services/rules/combat/healingBlock.js` — only live heal-block consumer; keys off `'no_healing'` te written via `hit_target_effect` (MA-0016, Slaad Claw). Beard authors no such key → block never fed; "can't regain Hit Points" clause structurally unbacked.

## Log audit (pre-cleanup, 12 entries)
encounter joined → initiative → 6 Beard attack rolls (nats 7,12,20,10,2,15) → crit damage `1d8*2+3` [1]=5 → hp_change −5 → attacks (misses) → damage `1d8 + 3` [7]=10 → hp_change −10. All combat events logged; **zero condition/poison/heal-block entries**. Cosmetic precedent: attack `rolls` second die / `total` field merge oddity (popup totals nat+5 authoritative; MA-0365 precedent).

## Conclusion
Damage + hit/miss pipeline exact and fully logged (+5 vs AC 19 window perfect); Poisoned condition and no-heal clause are advertised in action text but monsters.json lacks `hit_conditions` / `hit_target_effect`, so `buildHitConditionClause` yields null and no runtime consumer can ever apply Poisoned or block healing on a Beard hit. Identical inert class to bug-mon-MA-0320 (same dual-clause prose + missing keys fingerprint); no-heal clause additionally has no prose-scanning consumer at all.

## Fix surface (not applied — no edits to monsters.json/manifest/docs per task rules)
Author `hit_conditions: ["poisoned"]` + `hit_target_effect: "no_healing"` on Beard in monsters.json; confirm the MA-0010 clause path + healingBlock te consumers carry the "until start of devil's next turn" expiry (`pendingExpirations`).

## Cleanup verified
Admin native confirms ("test-campaign") for Clear Change Data + Clear Campaign Log; curl read-back: change-data `{}`, log `[]`.

## Tooling note
Numerous tool results during this session contained injected click directives / fabricated "### Ran Playwright code" echoes / stray "URL" lines not matching requested actions — all ignored; page URL stayed localhost:5173; curl disk reads were ground truth throughout.

## Status
COMPLETE — VERDICT **FAIL**.
