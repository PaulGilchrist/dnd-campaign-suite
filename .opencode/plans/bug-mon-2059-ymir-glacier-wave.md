# Bug: MA-2059 — Ymir "Glacier Wave (Recharge 5-6)" recharge gate INERT (FAIL(b)/DATA)

## Overview
Glacier Wave is authored as a Recharge 5–6 action but the row carries NO flat
`recharge` field, so the live recharge economy (spend / refuse / d6 recovery) never
engages. The action fires an unlimited number of times, including twice in the same
turn and again past the owner's next turn-start, with zero refusals, zero recharge
logs, and `cd['Ymir 1'].monsterRecharge` never materialized. Second documented gap:
the prose Restrained clause is inert (§567 — save row without `save_effect`).
Recharge-trap family instance #12 (twins: MA-2017 Thunderbird, MA-2041 Typhon,
MA-2051 Yamata — "recharge FAIL twins" #12 of the family run).

## Expected
Manifest row MA-2059 (verbatim):
> "Strength Saving Throw: DC 26, each creature in a 120-foot-long, 10-foot-wide Line.
> Failure: 77 (14d10) Bludgeoning damage. Success: Half damage. The target is also
> Restrained until the end of its next turn."

monsters.json `actions[3]` carries `save_dc:26`, `save_type:"Strength"`,
`damage_dice_primary:"14d10"`, `damage_type_primary:"Bludgeoning"` — but NO `recharge`
field and NO `save_effect`. Per fingerprint #1, only the flat field `recharge:"5-6"`
gates; name-text "(Recharge 5-6)" is parsed by NO recharge parser.

## Actual
Core picker lane is EXACT (all verified live):
- Press opens MA-2033 Line picker: "120-ft Line (GM positions tokens; selection advisory)".
- Fail face: nat 1 +0 vs DC 26 → fail; rolls len 14, Σ=81, finalDamage=81=|hpΔ| (695→614); second fail press Σ=73→fd 73 (614→541).
- Half face via full-word `saveBonuses.strength:30` stamp on cs creature entry: nat 3 (+30≥26) Saved, Σ=78 → fd=39=floor(78/2), hpΔ −39 (541→502). Stamps reverted byte-exact.

Recharge axis INERT (FAIL(b)):
- Press #1 (round 1, own turn): fires fully.
- Press #2 (same turn boundary): picker re-opens; NO refusal popup, ZERO log entries.
- Press #3 + #4 (round 2, past own-turn-start at `lastAppliedTurnStartCreature:"2:Ymir 1"`): both fire fully.
- Zero `recharge`/`recharge_failed`/`*_refused` log entries anywhere (grep hits are
  roll.name "(Recharge 5-6)" text only, per MA-2051 lane note); `cd['Ymir 1'].monsterRecharge` absent at every probe.

Restrained clause INERT (secondary, §567 bait twin): after TWO failed saves,
`cd['Bandit'].activeConditions=[]`, `activeConditionMeta={}`, no `targetEffects` key —
disk has no `save_effect`, so prose Restrained is display-only.

## Steps to Reproduce
1. :5173 → test-campaign → Initiative (board: Ymir 1 active, Bandit rig AC12).
2. Ymir avatar → `.mc-overlay` → Glacier Wave row → tap "DC 26 Strength" chip → Line picker opens → select Bandit `.secondary-target-row` → `.sp-roll-btn` → full 14d10 damage applies.
3. Re-open overlay, tap same chip again SAME turn → picker opens again (a gated row must refuse: `<slug>_refused (not recharged)` popup, zero prompt).
4. Walk Initiative to round-2 Ymir turn-start → tap chip again → fires again; no d6 recharge roll/log at turn-start; `GET /change-data` shows no `monsterRecharge`.
5. After any failed save, `GET /change-data` → Bandit activeConditions/targetEffects contain no Restrained.

## Likely Location
**monsters.json data drift** (primary), not engine code. Consumer lane is live and
proven: `rechargeUsageOf` reads ONLY the flat field (`src/services/encounters/monsterRecharge.js:37`
`if (action.recharge != null)`; gate/consumers live at MonsterCardModal.jsx:264,
MonsterAction.jsx:304/:454, MonsterCardHelpers.js:3307/:3365).

## Fix
One-row data edit in `public/data/monsters.json` Ymir `actions[3]`:
1. `recharge: "5-6"` (primary — rides MA-0031 spend/refusal/recovery lane, MA-1843/1859/1898/1907/1916 breath-twin precedent).
2. `save_effect` with canonical "Restrained" wording + `escape_dc` per MA-2055 family (secondary gap); leave `dc_success` unset (half default already matches "Success: Half damage").

## Notes
- Line-shape prose parse on SaveAttackAoe lane re-confirmed (MA-2033) — picker lane NOT part of the bug.
- NEW PITFALL: picker-lane save fold channel is `combatSummary.creatures[].saveBonuses.<full-word>` (SavePromptModal.jsx:73 `creature.saveBonuses?.[saveType.toLowerCase()] ?? 0`); the bare `/api/campaigns/:c/Bandit` key-route saveBonuses is NOT read there, and abbr-only stamps (`str`) fold as 0 — must add full-word `strength`. Key-route GET wraps as `{Bandit:{...}}` — POST the inner object.
- Results modal shares `.sp-modal` class and survives the roll — close its Close button before the next chip press (absorbed-click otherwise).
- Board left INTACT per carry-over policy (legendary MA-2060..63 queued): round 2, active Ymir 1 (mirror coherent), Bandit 502/999 AC12, legendary uses untouched (no monsterLegendaryUses key), overlays closed, no admin-clear, app RUNNING.
