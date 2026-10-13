# MA-2067 — Ziz "Solar Flare (Recharge 5-6)": recharge gate INERT — FAIL(b)/DATA (recharge-scoped)

## Title
MA-2067 Ziz Solar Flare (Recharge 5-6) — disk row carries NO flat `recharge` field, so the recharge economy never engages; ability fires unlimited times including twice past the owner's own-turn-start. 13th instance of the recharge name-text trap (twins: MA-2017 Thunderstrike, MA-2041 Storm Breach, MA-2051 Venom Mist, MA-2059 Glacier Wave — this row is #13 of the family run).

## Overview
Solar Flare renders a working inline block-save lane (DC 24 Constitution auto-roll vs armed Bandit 1, 9d10 Radiant, half-on-success engine default) — core numerics verified EXACT live across 4 presses — but "(Recharge 5-6)" exists ONLY in the row NAME. Per fingerprint #1 the name-text is parsed by NO recharge parser; only the flat field `recharge:"5-6"` gates. 4/4 presses resolved full saves+damage with zero refusals, zero spend, zero turn-start d6 recovery, and `change-data['Ziz 1'].monsterRecharge` never materialized.

## Expected (row + monsters.json)
Row MA-2067 (Ziz actions[3], verbatim):
> "Constitution Saving Throw: DC 24, each creature within 60 ft. Failure: 49 (9d10) Radiant damage. Success: Half damage."

Name declares "(Recharge 5-6)", so per RAW the ability must spend on fire (`monsterRecharge` + `ability_use` log), refuse re-presses (`.mc-recharge-refusal` + `solar_flare_refused`), and roll a d6 5+ regain at Ziz's own-turn-start.
monsters.json disk row (grep-cited 2026-10-12): `save_dc:24`, `save_type:"Constitution"`, `damage_dice_primary:"9d10"`, `damage_type_primary:"Radiant"` — **NO `recharge` key, NO structured `usage` object**.

## Actual
Recharge axis INERT (FAIL(b)):
- Press #1 (round 1, active=AasimarTest boundary): fires fully.
- Press #2 (SAME boundary, re-armed): fires fully again — no refusal popup, zero log entries.
- Presses #3 + #4 (past Ziz's own-turn-start; initiative walked 12 Next-clicks to `activeCreatureName:"Ziz 1"`, `__initiative__.lastAppliedTurnStartCreature:"2:Ziz 1"`): both fire fully. Turn-start `rollMonsterRecharges` silent no-op.
- Log grep: ZERO `type:"recharge"` / `recharge_failed` / `*_refused` entries (log 39→56, all deltas are save/damage/hp triples); `GET /change-data` → `monsterRecharge` ABSENT at every probe (byte-grep of full cd = false); chip never gained `mc-dice-link-spent-class` (`mc-dice-link-spell-spent`) — className stayed `mc-dice-link mc-dice-link-save mc-dice-link-save-clickable` before every press.

Core numerics (scope guard — NOT the bug): face pinned **inline (MA-2041 pin)** — prose "within 60 ft" contains NO shape NOUN (no Cone/Line/Sphere/Radius/Cube token; `breathAoeShape` null, MonsterCardModal.jsx:165 / :77-91), so NO picker opened, correctly. Every press log triple exact:
- `roll save` (Bandit 1, saveDc 24, Constitution, bonus +0 raw-Con-0 deterministic fail face; failure totals nat 18/3/4/8)
- `roll save-damage` (formula "9d10", len 9, Σ=49/42/33/49 == finalDamage)
- `hp_change` (Δ −49/−42/−33/−49 == |Σ|; Bandit chain 681→632→590→557→508, ample HP, unclamped)
Half-on-success face could not be forced live: inline lane reads `saving_throws.<abbr>.modifier`/`ability_score_modifiers` ONLY (MonsterCardHelpers.js getCreatureSaveModifier; §211 — change-data `saveBonuses` stamps structurally inert on this seam). Honest §211 note, adjudicated separately, not this row's defect; engine default `dc_success ?? 'half'` matches "Success: Half damage" by disk inspection.

## Steps to Reproduce
1. :5173 → test-campaign → Initiative (board: Ziz 1 490/490 AC21 + Bandit 1 999-rig AC12, round 1).
2. Ziz card `[data-testid="target-select"]` → Bandit 1; open Ziz `.mc-overlay`; Solar Flare row → "DC 24 Constitution" chip → inline save+damage resolves. Done.
3. Re-arm, re-open, click SAME chip same boundary → resolves again (a gated row must refuse: `.mc-recharge-refusal` + `solar_flare_refused`, zero prompt).
4. `.mc-close`, Next ×12 → active="Ziz 1" (lastAppliedTurnStartCreature "2:Ziz 1"), re-arm, press twice more → both fire; no d6 recharge roll/log at Ziz turn-start.
5. GET /api/campaigns/test-campaign/change-data → `Ziz 1.monsterRecharge` absent; log grep: zero recharge/refused entries.

## Likely Location
**monsters.json data drift** (`public/data/monsters.json` → Ziz → actions[3]) vs a fully-wired consumer. Consumer chain live and correct: `rechargeUsageOf` / `monsterRechargeGate` / `spendMonsterRecharge` / `rollMonsterRecharges` (src/services/encounters/monsterRecharge.js:35-47 gate returns null at :37 `if (action.recharge != null)` fails and no `usage.type =~ /recharge on roll/`; refusal popup builder :64+). No code change needed.

## Fix (one field)
`public/data/monsters.json` → Ziz → actions[3] add: `"recharge": "5-6"`.
After edit: admin-clear cd+log → reload → re-select → EB re-join → reopen card (name "(Recharge 5-6)" stays byte-unchanged; display unchanged). Rides MA-0031 spend/refusal/recovery lane, MA-2041/MA-2059 breath-twin precedent.

## Notes
- 60-ft multi-target advisory: prose "each creature within 60 ft." resolves single-armed-target inline (MA-0701 shapeless inline degradation, §211 twin) — advisory-only gap, per MA-2041 family precedent; the decisive defect is the missing recharge field.
- Board left INTACT for MA-2068 (Wing Shield reaction) + legendary rows: round 2 walk state, active=Ziz 1 (both mirrors honest, lastApplied "2:Ziz 1"), Ziz 490/490 AC21, Bandit 1 hp 508 (999-rig carry baseline), recharge pristine (never written), `monsterLegendaryUses` absent (legendary economy fresh), overlays closed, NO admin-clear, app RUNNING.
