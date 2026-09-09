# Bug — SP-125 Warding Bond: +1 AC not resolved in damage path; ward clock destroyed at round+1

## Title
SP-125 Warding Bond — resistance + caster mirror live-exact, but the +1 AC bonus never reaches the AC resolver and the ward te is stripped at the caster's NEXT turn-start (round+1) instead of lasting 1 hour.

## Overview
Verified live 2026-09-09 on Divine_Cleric lv17 (2024) bonded to EvasiveFighter vs EB Thug in "test-campaign". App-canonical Warding Bond is lv2, concentration FALSE in BOTH spells.json paths (canonical lv2-concentration divergence reported). Core pair (all-damage resistance + same-amount caster mirror) works exactly; two canonical numeric clauses do not resolve. Per CLA-336/SP-093 precedent (numbers that never reach the damage pipeline = FAIL, display-only buffs don't count), row is FAIL.

## Expected Behavior (canonical — app data quoted)
spells.json (both paths): target "gains a +1 bonus to AC and saving throws, and it has Resistance to all damage. Also, each time it takes damage, you take the same amount of damage… The spell ends if you drop to 0 Hit Points or if you and the target become separated by more than 60 feet. It also ends if the spell is cast again on either of the connected creatures." Duration 1 hour.

## Actual Behavior
- PASS legs (live): resistance halving exact (raw 7 → EF −3 = floor); caster mirror exact same amount (`hp_change delta:-3, abilityName:'Warding Bond'`); unwarded control takes full −3, no mirror; slot ledger pays (lv2 3→2→1→0 across casts, 1 FT-087 burn per §4); recast replaces target buff (exactly 1); buffs written to activeBuffs {acBonus:1, saveBonus:1, resistanceTypes×12}.
- **FAIL 1: +1 AC display-only** — resolver `targetAc` stayed 10 pre- and post-spell in attack logs (only shield/SoF/slow fold into AC; wardingBond's acBonus never consulted by the AC builder).
- **FAIL 2: clock destroyed round+1** — `addExpiration(rounds=undefined→Infinity)` + `expireOnCreatureName=caster` fires at caster's next turn-start (`currentRound>appliedRound`): target ward stripped live on round+1 (1→0) — a 1-hour ward surviving ~1 round.
- Gap: recast-after-early-strip stacks duplicate caster bond (existingBond check reads target buffs only, caster nBonds=2).
- +1 saves: grep-live consumers (saveProcessing.js:187, SavePromptModal.jsx:296), not live-probed.
- 0-HP break gate exists (applyWardingBond.js:20); >60ft gridless lenient §7.

## Steps to Reproduce
1. test-campaign: prepare+cast Warding Bond (lv2 slot pays) on EvasiveFighter from Divine_Cleric.
2. Walk initiative so EvasiveFighter is hit by EB Thug: log targetAc = 10 (expected 11).
3. Continue Next-walk past Divine_Cleric's next turn start: target's ward buff/te stripped (round+1), while raw duration should be 1 hour (600 rounds).

## Likely Location
- AC resolver: buildAttackContext / rules-armorClass.js (acBonus from activeBuffs source `warding_bond` never folded; contrast Shield of Faith fold).
- Expiration stamping: `wardingBondHandler.js` / `applyWardingBond.js` addExpiration call — pass `rounds:600` (CLA-334 hours×600 recipe) and drop the `expireOnCreatureName=caster` anchor (CLA-345 warns anchor-first-turn drains).

## Notes
- Fix recipe: mirror verified CLA-334 rounds encoding + CLA-356 roll legs; existingBond check should scan caster store too.
- Playbook §46k recipe (mi-skip-btn, FT-087 hydration, popup adjudication tokens) records the probe path.
