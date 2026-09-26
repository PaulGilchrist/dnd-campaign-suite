# MA-1313 — Pirate Captain "Riposte" (reaction) — FAIL(b) zero-affordance

- **Monster**: Pirate Captain (`public/data/monsters.json`, index `pirate-captain`)
- **Category**: reactions[0] — Riposte
- **Trigger (authored)**: "The pirate is hit by a melee attack roll while holding a weapon"
- **Description (authored)**: "The pirate adds 3 to its AC against that attack, possibly causing it to miss. On a miss, the pirate makes one Rapier attack against the triggering creature if within range."
- **Verdict**: FAIL(b) — DATA, zero affordance (§60). Family: MA-1285 / MA-1290 / MA-1309 (+ §1251 advisory precedent).
- **Date**: 2026-09-26, live test-campaign (header verified)

## Disk fingerprint

Pirate Captain `reactions[0]` keys = `name`/`trigger`/`description` ONLY. No `automation`, no `advisory`, no `usage`.
§60: monster reaction rows without `automation:{type,trigger,effect}` are inert prose.

## Static evidence (own greps, re-cited)

- `rg -l -i riposte` app-wide hits: `class-fighter-rogue/` (executeManeuver.js, executeActionManeuvers.js + tests), `useCombatSuperiorityModal.js` (:55, :149), `attackPostProcessing.js` (:20-23, :159-171 — `pendingRiposteDieValue` superiorility-die lifecycle), `useLoggedDiceRollAttack.js`, `CharSpecialActions.jsx`, `CharReactions.riposte.test.jsx`, initiative nav, `attackRollDamageCalc.js` — **ALL PC Battle-Master lane, superiority-dice gated**.
- Zero monster-side consumers: no `riposte` in `src/components/encounter/` (non-test), no `src/services/combat/` monster handler.
- Monster gated-reaction registry `src/components/encounter/MonsterCardHelpers.js` — 13 keys:
  feather_fall :982, counterspell :988, hellish_rebuke :996, parry :1007, shield :1026, jinx_negate :1039, split :1053, heal :1062, attack :1076, portent :1086, limited_foresight :1103, elemental_absorption :1123, redirect_attack :1140 — **NO `riposte` entry**.

## Live census (test-campaign, 2026-09-26)

- Header verified `test-campaign` immediately after select.
- EB exact-td native `cb.click()` tick ['Bandit','Pirate Captain'] → both `checked=true` → explicit "Join Encounter".
- Initiative tracker shows Bandit 1 + Pirate Captain 1 (HP 84, init 12). Baseline log 0.
- `img.avatar-image[alt="Pirate Captain 1"].click()` → `.mc-overlay` "Pirate Captain 1 — Medium Humanoid, Neutral".
- Riposte row DOM: `<strong>Riposte.</strong>` + description span ONLY (parent text: "Riposte. The pirate adds 3 to its AC…").
  buttons 0, links 0, inputs 0, selects 0, diceLinks 0, advisoryChips 0, gatedSlots 0, interactive [] — **zero controls**.
  Cosmetic note: authored `trigger` text is not rendered at all (name+description only) — same quirk as MA-1285.
- Center-click probe ×2 at row center (`elementFromPoint` + dispatched click): popups 0→0, log delta 0 (0→0), riposte log entries 0. App console clean (the 2 session console errors were harness wrong-endpoint fetch probes during log verification, not app defects).
- RAW defense un-automatable structurally: no AC-buff producer, no conditional counter-attack consumer, no gate — nothing can fire.

Cleanup: Admin → Full Reset (native confirm accepted via in-page listener, one snippet) → post-verify `/api/campaigns/test-campaign/change-data` = `{}`, log = 0 entries.

## Fix options

### Option A — interim advisory (cheap, zero-code, §1251 / MA-1251 precedent)
Add one field to the row: `advisory: "monster_riposte"`. Advisory seam is a GENERIC passthrough (`!!row.advisory`, value never inspected, category-agnostic — `MonsterAction.jsx` AdvisoryLink, record-only popup + log, CLA-320 GM-enforced). Semantics stay GM-enforced: "+3 AC, miss → make a rapier attack yourself" advisory popup + log. Unblocks now; does NOT automate.

### Option B — full fix: AC-buff + conditional counter-attack chain (heaviest of the family)
Family so far: MA-1285 Uncanny Dodge (halve damage), MA-1290 Warding Charm, MA-1309 Defensive Stance — all single-shot. Riposte is the only two-stage chain: (1) mutate the *incoming attack roll* outcome (+3 AC vs that attack), (2) *conditionally* spawn a counter-attack only if that mutated roll misses.
1. **DATA**: `automation:{type:"reaction", trigger:"melee_hit_target", effect:"monster_riposte", usage:"At Will"}` on the row.
2. **CODE**: registry entry in `MonsterCardHelpers.js` gated-reaction dict + gate that arms on campaign `lastAttack` where this monster is target and it holds a melee weapon (weapon-held state does not exist in the monster model today — new field needed).
3. **CODE**: AC-buff consumer at the attack-roll seam — the +3 must beat the *already-rolled* attack total, i.e. re-resolve `attackTotal + 3 < AC → miss` AFTER the press (Shield :1026/:1416 is the only live AC modifier precedent, and it is spell-targeted only; no melee re-resolve channel exists).
4. **CODE**: conditional counter-attack — clone the Berserk Lashing `attack` :1076 counter channel, but gated on the miss result from step 3, then splice the counter's own attack roll + Rapier damage (2d8+4) through the pipeline, plus spend/latch + `monster_riposte_resolved` log.
- **§214/§233 pitfall**: pressing a defender chip tears down the attacker's pending-Done `.popup-overlay` — model must arm a one-shot that the NEXT resolved interaction consumes.
- Register any new te in `targetEffectDefinitions.js` (§5 te-registry rule).

**Recommendation**: Option A unblocks now (one field, zero code); Option B is RAW-correct but is the heaviest install in the MA-1285/1290/1309 family — needs an attack-outcome re-resolve seam that does not exist in the monster reaction architecture.

## Registry delta

Pirate Captain → **MIXED**: Rapier/Pistol rows carry `attack_bonus`/damage-dice (attack chip lane live), Captain's Charm carries `save_dc` 14 (save chip lane live), but reaction lane Riposte = zero affordance, no registry key, no automation → card is partially live, defense-dead.
