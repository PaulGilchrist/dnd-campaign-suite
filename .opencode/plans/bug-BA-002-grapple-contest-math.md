# BUG BA-002 — Grapple base action: contested check math wrong (no proficiency, no skill contest)

## Title
BA-002 "Grapple" (base action) fires and stamps Grappled, but the contested ability check is not the specified Athletics (STR+prof) vs target Athletics-or-Acrobatics contest — it rolls bare STR (no proficiency) vs a static target STR modifier.

## Overview
The Grapple action renders, is clickable, runs a Strength check, and stamps the `grappled` condition on the target with a log. So the producer is NOT inert (that part works). But the check numerics are wrong vs the canonical rule: the attacker's proficiency bonus is not added, and the target does not make (or offer) an Athletics-or-Acrobatics contest roll — the app compares against a static "target STR (+0)". This is close-but-not-exact and counts as a bug (FAIL flavor a), not a pass.

## Expected Behavior (canonical wording, manifest row BA-002 + PHB grapple)
> "make a Strength (Athletics) check contested by the target's Strength (Athletics) or Dexterity (Acrobatics) check. If you succeed, the target is Grappled."

Attacker total = d20 + STR modifier + proficiency (when proficient in Athletics). Target rolls (or the contest resolves against) the higher/appropriate of target Athletics vs Acrobatics.

## Actual Behavior
Live evidence (test-campaign, 2026-10-05), host DraconicDragon (lv20 Barbarian, STR 20 +5, PB +6, **proficient in Athletics** — disk `proficientSkills` includes "Athletics"), target Bandit 1 (STR 11 +0, DEX 12 +1):
- Popup: `Grapple successful! (d20: 17 + 5 = 22) vs target STR (+0)`
- Log `ability_use`: `Strength check: 22 (d20: 17 + 5) vs target STR (+0) — Success. Target is now grappled.`
- change-data `Bandit 1` → `activeConditions:["grappled"]` (stamp works).

Defects:
1. **Attacker proficiency missing.** Expected `d20 + STR(5) + PB(6) = d20+11`; app rolled `d20 + 5` (STR only). A lv20 Athletics-proficient grappler never adds PB.
2. **No skill contest.** Expected contest vs target's Athletics-or-Acrobatics check (target chooses). App compares against a flat `target STR (+0)` — not a skill check, no Acrobatics option, no target roll.

## Steps to Reproduce
1. test-campaign, DraconicDragon (Barbarian lv20, Athletics proficient), EB-join Bandit 1.
2. Arm Bandit 1 as target, click the "Grapple" base action on the character sheet.
3. Observe the popup/log formula. EXPECTED `d20 + 11` vs an Athletics/Acrobatics contest roll; ACTUAL `d20 + 5` vs static `STR (+0)`.

## Likely Location
- Manifest handler `src/services/combat/automation/handlers/baseActionHandler.js` is STALE — does not exist. Real producer: `useCharActionsBaseActions.js:344` (per subagent). The contest builder there omits attacker skill proficiency and resolves the contest against the target's raw STR modifier instead of an Athletics-or-Acrobatics check.

## Notes
- Core fire + grappled stamp are genuine (not inert); this is a value/gate FAIL, not a zero-delta FAIL(b). Sustained grapple state-machine (escape / end-grapple) remains zero-producer per playbook MA-0287/0288/0354 — separate known residual, do not re-litigate here.
- Design options: (A) thread attacker proficiency + skill bonus into the check; (B) add a target-contest selector (Athletics vs Acrobatics) defaulting to the target's higher.
