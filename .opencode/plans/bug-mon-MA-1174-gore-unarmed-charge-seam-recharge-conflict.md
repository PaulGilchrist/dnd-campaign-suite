# BUG MON MA-1174 — Minotaur of Baphomet / Gore (actions[1]) — FAIL(a)/DATA

Date: 2026-09-25 · Campaign: test-campaign (header verified) · Disk: public/data/monsters.json (index `minotaur-of-baphomet`, actions[1])

## VERDICT: FAIL(a)/DATA — numbers axis exact (PASS), but BOTH axis-2 (charge seam live-unarmed) and axis-3 (recharge field vs description conflict) confirmed.

## Disk row (verbatim, byte-checked)
Fields present: name, description, attack_bonus:6, save_dc:0, save_type:"", save_effect:"", range:"", reach:"5 ft.", **recharge:"5-6"**, damage_dice_primary:"4d6 + 4", damage_type_primary:"Piercing".
Fields ABSENT: `conditional_damage`, `hit_conditions`, `damage_dice_secondary`, `hit_target_effect`.
Description: "Melee Attack Roll: +6, reach 5 ft. Hit: 18 (4d6 + 4) Piercing damage. If the target is a Large or smaller creature and the minotaur moved 10+ feet straight toward it immediately before the hit, the target takes an extra 10 (3d6) Piercing damage and has the **Prone** condition."
Whole-entry grep: `"recharge":` ×2 (Glaive "" + Gore "5-6"); prose token `Recharge` count **0**.

## AXIS 1 — NUMBERS: PASS (exact)
Live 6 fires vs Bandit 1 AC12 (cs currentHp:999 TRUSTED-keyboard rig §454 BEFORE arm §148/§447; arm server-proof cs.creatures['Minotaur of Baphomet 1'].targetName='Bandit 1' §452):
- Nats (nat+6 vs AC12): 8→14✓ · 11→17✓ · 11→17✓ · 7→13✓ · 18→24✓ · 5→11✗ honest boundary miss. Popup leading-digit totals==nat+6 6/6 §452. All attack logs bonus:6, targetAc 12, mode normal.
- ONE damage entry per hit 5/5: formula byte-exact **"4d6 + 4"** Piercing. EXTRA FIELDS (verbatim record): NO secondaryFormula/autoDamageSecondaryFormula, NO secondaryRolls/secondaryTotal/secondaryDamageType, NO extra-damage key of any kind — `secondary`/`extra` key grep of every damage entry = []. note:"combined_damage_roll".
- fd==|hpΔ| every hit: 17·18·15·23·23; chain 999→982→964→949→926→903; Σfd 96 == 999−903 EXACT.
- 0 nat20 in 6-fire budget → §32 crit seam UNOBSERVED (MA-1173/1171 precedent honest).
- Log-delta after every press §442, zero absorbed; Done-only resolution via button.dice-roll-reroll-btn §458; misses Done-less el.click flush §1115.

## DEFECT 1 (AXIS 2) — CHARGE CLAUSE live-unarmed: FAIL(a)/DATA
- Disk authors NOTHING for the charge rider: the extra 10 (3d6) Piercing + Prone live ONLY in prose. No `conditional_damage` (§460: conditional_damage seam is LIVE — buildChargeBonusOffer MonsterCardHelpers.js:597 → chargeBonusOffer MonsterCardModal.jsx:1085 → HIT popup grant/decline DiceRollResult.jsx:839; byte-twin Chimera MA-0485 `conditional_damage:{dice,modifier,condition}`). No `hit_conditions:["prone"]` (MA-0763/MA-1116 shape, buildHitConditionClause Helpers:648; manifest-derived action.conditions has ZERO attack-path consumers §449).
- Live probe (5 HIT popups verbatim): e.g. "Gore 14 d20 8 +6 (+6 to hit) ✓ HIT (14 vs AC 12) Done click to dismiss" — NO charge grant/decline offer appears on ANY hit; zero extra-damage entries; zero condition/prone logs all session; Bandit never gained Prone.
- Movement-state audit: app is gridless; grep for "moved 10+ ft" tracking consumer = ZERO (only PC stance `Ram` exists, MA-1127 §451) — the conditional_damage HIT-popup GM grant/decline IS the sanctioned adjudication seam, and this row does not arm it.

## DEFECT 2 (AXIS 3) — RECHARGE CONFLICT: FAIL(a)/DATA (GM-visible contradiction)
- Disk authors `recharge:"5-6"` while name "Gore" and description contain NO "Recharge" text (verbatim, zero prose token). Manifest rule: name/description recharge text must match authored field — VIOLATED.
- Canonical 2024 Minotaur of Baphomet Gore has NO recharge (charge rider only) → the authored `recharge:"5-6"` field is the likely drift (2014-style residue / copy error); do NOT fix expectations.
- Live gate MA-1164/1168/0294 shape CONFIRMED:
  - Row renders GM-visible chip **"(5-6)"** at row end despite recharge-free prose (row text verbatim ends "…Prone condition. (5-6)").
  - Fire spends at once: ability_use verbatim "Minotaur of Baphomet 1 uses Gore — Recharge 5-6; unavailable until a d6 5+ at the start of Minotaur of Baphomet 1's next turn."
  - Second same-round press → `.mc-recharge-refusal` popup + log verbatim "Minotaur of Baphomet 1 Gore refused (not recharged) — requires a d6 5+ at the start of Minotaur of Baphomet 1's turn. Zero spend, no save prompt."
  - Walk-hog cycle (§466): turn-start d6 rolls; recovery by recharge/recharge_failed log dice (failed d6 2,4,1,4 / recovered d6 6,5,5,6; ~17 clicks per recovery, 16-creature board).
- Effect: gated-ungated-by-description — a RAW-at-will charge attack is metered 1/round+ gated behind a phantom recharge the book text never mentions.

## SUGGESTED FIX (public/data/monsters.json actions[1])
1. `"recharge": "5-6"` → `"recharge": ""` (canonical 2024 Gore = no recharge; removes gate + phantom "(5-6)" chip).
2. Add charge rider vocabulary the live seam consumes:
   `"conditional_damage": { "dice": "3d6", "modifier": 0, "damage_type": "Piercing", "condition": "prone" }` (MA-0485 Chimera byte-shape) → arms HIT-popup GM grant/decline for the +3d6+Prone charge clause (gridless sanctioned adjudication).
   Optionally also `"hit_conditions": ["prone"]` only if the design wants auto-grant on every hit — NOT RAW-correct for a conditional clause; conditional_damage popup is the correct transport.
3. Manifest docs/monster-actions-manifest.json MA-1174: recharge→"", conditions keep ["prone"] as prose mirror, verified field stays until re-verify.

## CLEANUP — PASS
Admin-panel UI only: "Clear Change Data" + "Clear Campaign Log" real clicks; confirms carried exact token "test-campaign" (auto-handled = accept proof §472/§460). Post-GET log=[] cd={} cs {value:null}; 12s quiet re-GET held []/{} (§15). Header remained test-campaign throughout. Console: zero app errors (one agent-side evaluate typo ReferenceError only).
