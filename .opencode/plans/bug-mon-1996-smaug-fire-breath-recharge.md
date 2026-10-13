# MA-1996 — Smaug the Golden · Fire Breath (Recharge 5-6): recharge name-text inert, never spends/refuses/recovers

**Verdict: FAIL(b)/DATA** — scoped to RECHARGE only. Core cone/save numerics are CORRECT (see Notes).

## Overview
Smaug's Fire Breath row carries "(Recharge 5-6)" in the action NAME only. No parser reads name-text —
the recharge gate (`rechargeUsageOf`/`monsterRechargeGate`) reads only the flat `action.recharge` field
(or a structured `usage.type` matching /recharge on roll/). The row authors NEITHER, so the gate is
`null` and the 5e recharge economy is completely INERT: Smaug fires 3 cones in one fight with zero spend
stamp, zero refusal popup, zero refusal log, zero recovery d6 — including past his own turn-start twice.
Fingerprint #1 recharge name-text trap; 9th instance of the MA-0031/0488/0618/0663/1916/1924/1948/1978/1987 family.

## Expected (row + monsters.json)
Row MA-1996: `"Fire Breath (Recharge 5-6)"` — Dexterity Saving Throw DC 24, 90-foot Cone,
Failure 77 (22d6) Fire, Success half. "(Recharge 5-6)" implies per §13 recharge economy:
spend stamp `<Monster>.monsterRecharge {recharged:false,threshold:5}` at fire/picker-open,
re-press before recovery REFUSES (`.mc-recharge-refusal` + `<slug>_refused` log + chip
`mc-dice-link-spell-spent`), recovery d6 at owner's own turn-start.

monsters.json Fire Breath row keys (verified on disk): `damage_dice_primary`("22d6"),
`damage_type_primary`("Fire"), `description`, `name`, `save_dc`(24), `save_type`("Dexterity") —
**NO `recharge` field, NO `range` field**. "(Recharge 5-6)" is name-text only.

## Actual
Gate never engages. Three full volleys resolved across round 1 → round 2 (spanning owner turn-start)
with ZERO recharge enforcement of any kind.

## Steps to Reproduce
1. test-campaign :5173, board: Smaug 1 AC22 + Bandit 1 AC12 (round 1). EB-join 1 more Bandit (Bandit 2,
   rig 999/999 via full-store cs POST).
2. Open Smaug card → Fire Breath row → `DC 24 Dexterity` chip → cone picker opens → select Bandit 1 + Bandit 2
   → confirm → damage applies. **Press #2/#3 immediately (no recovery) and again after walking initiative past
   `lastAppliedTurnStartCreature:"2:Smaug the Golden 1"`** → picker re-opens every time, fires every time.

## Evidence (live, 2026-10-12)
- Picker opens each press: `.sp-overlay` "90-ft Cone (GM positions tokens; selection advisory) … Dexterity
  saving throw (DC 24) … 22d6 Fire … half damage" — range parsed from DESCRIPTION prose (MA-0618/§62 works).
- Press #1 log (`rollType:"save-damage"`): Bandit 1 nat 13+0 vs DC 24 FAILURE 22d6 rolls[22 dice]=74 Fire,
  finalDamage 74, hp_change −74 (708→634); Bandit 2 nat 15 FAILURE =61, −61 (999→938). EB-NPC raw-bonus-0
  deterministic fail face at DC24 (nat cap 20 < 24, MA-369) — `saveBonus:0` byte in both entries. fd==|hpΔ| each.
- Press #2 (success face, full-word rig): cs full-store POST `Bandit 1.saveBonuses.dexterity:+19` →
  Bandit 1 nat 18 sr:"success" total 86 → **finalDamage 43 = floor(86/2)** (MA-1970 picker determinism live);
  Bandit 2 fails 76 full. Press #3: Bandit 1 79→39 halved again; Bandit 2 nat 20 fail =72 full.
- **RECHARGE INERT (FAIL proof):**
  - Grep: consumers EXIST — `MonsterCardModal.jsx:264 monsterRechargeGate(action, getRuntimeValue(...))`,
    `MonsterAction.jsx:304/:454 rechargeSpent(monsterRechargeGate(...))`.
  - `src/services/encounters/monsterRecharge.js:35-37` — `rechargeUsageOf` reads ONLY
    `action.recharge != null` (flat) then `usage.type` /recharge on roll/ → Smaug row matches NEITHER →
    gate null at every consumer → no spend, no refuse, no recovery.
  - After all 3 volleys + owner turn-start walk (round 2): change-data
    `cd['Smaug the Golden 1'].monsterRecharge === null` (never stamped); log has **0** `type:"recharge"`
    entries (audited by type, never substring — MA-1948); **0** `<slug>_refused` log entries; no
    `.mc-recharge-refusal` popup ever rendered; chip class after 3 fires remains
    `mc-dice-link mc-dice-link-save mc-dice-link-save-clickable` — **NO `mc-dice-link-spell-spent`**.
  - Recovery lane: `__initiative__.lastAppliedTurnStartCreature` reached `"2:Smaug the Golden 1"` —
    no recovery d6 rolled (nothing to recover: spend never happened). Spend/refusal/recovery NEVER engages.

## Likely Location
**DATA layer — `public/data/monsters.json`** (Smaug the Golden → actions[Fire Breath]). Engine lane is
LIVE and correct (MA-0031/0488/0618 consumers, picker-surface spend verified MA-1987). One-field fix:
add `"recharge": "5-6"` to the row (byte-companion `range:"90-foot Cone"` recommended for MA-0618
range-field hygiene but the description-parse seam carries it today).

## Notes — CORE numerics ARE CORRECT (bug scoped to recharge only)
- Cone picker opens without a `range` field via description parse (§62/MA-0618): "90-foot Cone" → picker,
  ≥2 selectable targets (13 listed; Bandit 2 100% HP / Bandit 1 71% HP shown).
- DC enforced 24, save type Dexterity on every entry (`saveDc:24`, `saveType:"Dexterity"`);
  `dcSuccess:"half"` auto-fabricated — engine default `dc_success ?? 'half'` matches row "Success: Half".
- Half-on-success exact floor: 86→43, 79→39. Full-on-fail exact rolled-dice fire damage; fd==|hpΔ| on all
  six victim legs; HP ledger closed (end: Bandit 1 552/999, Bandit 2 790/999).

## Cleanup state
Board LEFT INTACT for MA-1997..MA-2002 (Frightful Presence + legendary queue): Smaug 1 AC22 513/513,
Bandit 1 AC12 552/999, Bandit 2 AC12 790/999 (rigged maxHp 999), round 2, activeCreatureName walk-truth
2:Smaug the Golden 1 zone, conditions cleared on both Bandits, success-rig `saveBonuses.dexterity` stamp
REMOVED (verified absent), `.mc-overlay` closed, NO admin-clear, app RUNNING. Note: Bandit 2 is a NEW
board member introduced this row (init 4, ac12) — carried forward for reuse.

## Pitfalls (confirmed/new)
- Joining 1 more Bandit via EB mid-combat lands it in initiative (init 4, RAW 11 HP) — rig 999 via
  full-store cs POST before ANY cone press or it dies on press #1.
- Avatar-click auto-open flake post-turn-start: absorbed first click can surface the WRONG creature's
  `.mc-overlay` (Bandit 2 surfaced twice while targeting Smaug) — always assert overlay owner
  (`ov.innerText.startsWith(name)`) before chip work; `.mc-close` + fresh boundingClientRect re-click fixes.
- cs full-store POST (HP/stamp edits) does NOT disturb the open sp-overlay picker lane; full-word
  `saveBonuses.dexterity` folds at the picker seam instantly (MA-1970 re-confirmed), abbrev `dex` ignored.
- 22d6 rolls vary per victim within one volley (74/61) — never expect a shared damage total per press.
