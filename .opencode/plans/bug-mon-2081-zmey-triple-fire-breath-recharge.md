# MA-2081 — Zmey Gorynych "Triple Fire Breath (Recharge 5-6)": recharge is name-text only, never gates — FAIL(b)/DATA (recharge-scoped)

## Title
MA-2081 Zmey Gorynych Triple Fire Breath (Recharge 5-6) — missing flat `recharge` field makes the recharge gate structurally inert (recharge name-text trap, fingerprint #1; MA-2059 Ymir Glacier Wave twin, family instance continuing the MA-1996→MA-2067 run).

## Overview
Row MA-2081 (Zmey actions[3]) renders a fully-working MA-2033 picker lane — "90-ft Cone" prose noun opens the SaveAttackAoeModal and core numerics resolve EXACT across five live presses — but "(Recharge 5-6)" in the name is display text only. The disk row carries NO flat `recharge` field and NO structured `usage` object, so `rechargeUsageOf()` returns null at the gate seam and the breath fires unlimited times per turn and across turns with zero spend, zero refusal, zero turn-start d6 recovery. Recharge-scoped FAIL(b); picker + core PASS.

## Expected (row + monsters.json)
Manifest row MA-2081 (verbatim):
> "Dexterity Saving Throw: DC 23, each creature in a 90-foot Cone. Failure: 49 (11d8) Fire damage. Success: Half damage."

monsters.json `actions[3]` disk-cited 2026-10-12: `save_dc: 23`, `save_type: "Dexterity"`, `damage_dice_primary: "11d8"`, `damage_type_primary: "Fire"` — **NO `recharge` key** (and no `usage`). Per fingerprint #1, only the flat field `recharge:"5-6"` gates; RAW requires spend-on-fire (`monsterRecharge` + spend log), refusal of re-presses (`*_refused`), and d6 5+ recovery at Zmey's own-turn-start.

## Actual
- **Recharge INERT (FAIL(b))** — 4/4 ungated fires:
  - #1 round 2 own-turn: picker opens, Bandit fail, Σ=64 len-11 → fd 64, hp 751→687.
  - #2 SAME turn boundary: picker re-opens (a gated row must refuse); fires again Σ=45 → fd 45, 687→642.
  - #3 + #4 past own-turn-start (`lastAppliedTurnStartCreature:"3:Zmey Gorynych 1"`): both fire fully — Σ=48 → fd 48 (642→594), Σ=47 → fd 47 (594→547).
  - Zero `type:"recharge"` log entries (log grep = 0), zero `refus*` entries anywhere (grep = 0), no `.mc-recharge-refusal` in DOM, chip never gained `mc-dice-link-spell-spent`, `change-data['Zmey Gorynych 1'].monsterRecharge` **absent at every probe** — turn-start `rollMonsterRecharges` silent no-op at rounds 2 AND 3.
- **Picker + core EXACT (not the bug)**: press opens sp-modal "90-ft Cone (GM positions tokens; selection advisory)" from prose noun (MA-2033 lane); `.sp-roll-btn` disabled at 0-selected, enabled after GM-select Bandit 1 row; raw-Dex fail face (dex +1, max total 21 < DC 23) failed all four presses; every log = `roll save-damage` formula "11d8", len 11, Σ==finalDamage, Fire + `hp_change` Δ==|Σ|. HALF face: full-word `cs saveBonuses.dexterity:30` stamp on Bandit cs entry → nat 5 "Saved", Σ=56 → fd=28=floor(56/2), hpΔ −28 (547→519). Stamp reverted **byte-exact** (GET compare vs backup = True).
- **No riders (axis C)**: disk row has no `save_effect`/`conditions`; after five saves Bandit `activeConditions`/`targetEffects`/`activeConditionMeta` carry zero entries; zero condition logs. Correct by absence.

## Steps to Reproduce
1. :5173 → test-campaign → Initiative (board: round 2 active Zmey Gorynych 1, Bandit 1 rig AC12).
2. Zmey avatar → `.mc-overlay` → "Triple Fire Breath (Recharge 5-6)" row → tap "DC 23 Dexterity" chip → 90-ft Cone picker opens → select Bandit 1 `.secondary-target-row` → `.sp-roll-btn` → full 11d8 damage applies.
3. Re-tap same chip SAME turn → picker opens again and fires (expected: `.mc-recharge-refusal` popup + `<slug>_refused` log, zero prompt).
4. `.mc-close`, walk Next → past Zmey round-3 turn-start → tap chip → fires again; no d6 recharge roll/log at either turn-start; GET /change-data → `Zmey Gorynych 1.monsterRecharge` absent forever.

## Likely Location
**monsters.json data drift** (`public/data/monsters.json`, Zmey Gorynych `actions[3]`), NOT engine code. Consumer chain live and correct: `rechargeUsageOf` / gate / spend / turn-start recovery in `src/services/encounters/monsterRecharge.js:35-46` — line 37 `if (action.recharge != null)` is the ONLY flat-field read, falling through to the structured-usage branch and `return null` at :46 for this row, so the gate never engages. No code change needed.

## Fix (one field)
`public/data/monsters.json` → Zmey Gorynych → actions[3] add: `"recharge": "5-6"`.
Name "(Recharge 5-6)" stays as authored (display unchanged). After edit: admin-clear cd+log → reload → re-select → EB re-join → reopen card.
CAUTION for the fix window: legendary "Wing Buffet (Costs 2 Actions)" carries `delegates_to: "Triple Fire Breath (Recharge 5-6)"` — after gating lands, verify the delegate lane's spend/refusal accounting shares (or intentionally bypasses) the recharge economy before closing MA-2076..79.

## Notes
- MA-2059 twin recipe confirmed end-to-end: picker-lane half face = full-word `saveBonuses.<full-word>` on the victim's cs creature entry (SavePromptModal reads `saveBonuses?.[saveType.toLowerCase()]`); abbr-only stamps fold 0. Full-store cs POST preserved `activeCreatureName` truth here (cs object carries no mirror field in this campaign — no unstick needed).
- Per-press ledger: 751→687→642→594→547→519 (five fires, same GM turn block; four raw fails + one forced save).
- Board left INTACT for queued legendary rows MA-2076..79 (incl Dust Storm + Wing Buffet hijack rows): round 3, active Zmey Gorynych 1 (ts `3:Zmey Gorynych 1`), Zmey 486/486, Bandit 519/999 AC12, cs byte-exact-reverted, monsterRecharge absent (pristine-inert), monsterLegendaryUses absent, overlays closed, NO admin-clear, app RUNNING.
