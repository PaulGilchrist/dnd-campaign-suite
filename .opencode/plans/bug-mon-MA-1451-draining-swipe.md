# BUG MA-1451 — Shadow "Draining Swipe": Strength-drain hit-effect zero-state (FAIL(a))

**Row:** MA-1451 · shadow|actions|0 · Shadow · Draining Swipe · attack+save (cosmetic label; save_dc 0/save_type "" — pure attack row)
**Date:** 2026-09-27 · campaign: test-campaign (header verified) · rig: EB join Shadow 1 + Bandit 1 (AC12, resistances/immunities/vulnerabilities null = clean Necrotic victim, maxHp staged 999 via full cs-store POST)

## Verdict: FAIL(a) — attack core exact, promised Strength-drain rider leaves ZERO observable state

Precedent: MA-0090-family "hit/save fails leave zero state" (playbook §53); random-d4 riders zero-transport §107 (MA-0575: hit_conditions is static-list only, needs new chooser/rider producer template).

## Attack core — PASS legs (evidence)
- Chip: single "+4" in `.mc-action` strong "Draining Swipe." (§116 single-chip correct).
- 5 chip fires vs Bandit 1 AC12, armed on Shadow own-card `[data-testid="target-select"]`:
  - nat6+4=10 ✗ · nat10+4=14 ✓ · nat3+4=7 ✗ · nat15+4=19 ✓ · nat3+4=7 ✗
  - Log attack entries: total=raw d20, targetAc:12, hit flags match popup ✓/✗ glyphs (§33).
- Damage (both hits): formula "1d6 + 2" Necrotic byte-exact disk-match, rolls [1]→finalDamage 3 and [3]→finalDamage 5 (range 3–8 ✓); hp_change Δ−3 (999→996) and Δ−5 (996→991) — hpΔ==finalDamage exact, no resistance halving (victim clean confirmed live).
- Boundary: nat10→14 HIT / nat6→10 MISS bracket AC12; exact nat8→12 / nat7→11 tie not rolled within 5-loop cap (honest note; +4 bonus verifiably applied on every roll).

## Defect — Strength drain clause inert (machine-proof)
Rule text: "Hit: ... **the target's Strength score decreases by 1d4.** The target dies if this reduces that score to 0."
1. **DATA — rider fields absent:** monsters.json shadow.actions[0] authors only attack_bonus/dice/reach. No `ability_drain`, no `hit_conditions`, no `hit_target_effect`, no structured drain/summon clause. (Contrast live twins: `hit_conditions:["poisoned"]` MA-0010/MA-0621, `hit_target_effect` transport MA-0733 §215.)
2. **CONSUMER — grep-zero app-wide:** `grep -rin "ability_drain|abilityDrain|strength.*decrease|decrease.*strength|score.*drain|drain.*score" src/ server/` → ZERO non-test hits. No ability-score-drain machinery exists in the engine.
3. **te registry:** `grep -in "strength|drain" src/services/combat/conditions/targetEffectDefinitions.js` → no strength/ability-drain te (only enlarged/weakened-family descriptions mentioning Strength checks). Nothing to grant.
4. **LIVE probe on every hit:** Bandit 1 card STR 11 (+0) unchanged after 2 landed hits (disk 11 → card 11); change-data `'Bandit 1'` keys EMPTY after hits; top-level `targetEffects` untouched; whole-log grep strength/drain/weaken matches ONLY the ability name "draining swipe". Zero drain log entries, zero 1d4 roll entries, zero condition.
5. **§107 fingerprint:** even if authored as static hit_conditions, a random 1d4 magnitude drain has zero transport app-wide (hit_conditions grants fixed conditions, no numeric-attribute-delta channel).

## Kill-summon clause (advisory, not separately scored)
"If a Humanoid is slain by this attack, a Shadow rises from the corpse 1d4 hours later." NOT executed live (would require killing humanoid; unmodelable): grep `rises from the corpse|shadow rises|shadow.*summon` → prose-only in monsters.json; `monsterSummon.js` seam is drow-mage demon-summon only (MA-0648) with no shadow option; no corpse-reanimation consumer app-wide (§70-class).

## Bug layer (both axes)
- **Layer 1 (DATA):** row lacks structured drain rider (e.g. `ability_drain:{score:"str",dice:"1d4"}` / hit-rider field) — one-field-ish data gap vs proven rider templates.
- **Layer 2 (CODE — primary):** NO ability-score-decrease consumer seam exists app-wide; data authoring alone cannot land the clause. Fix = new numeric-attribute-drain transport template (grant on hit via merged setRuntimeObject + per-target abilityScores delta + drain log + expiry/rest restore + death-at-0 clause) registered te + registry entry (§36).

## Cleanup
Admin-clear change-data + log POSTed at session end; end-state reported in run log.
