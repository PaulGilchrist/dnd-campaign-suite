# Bug MA-0839 — Gibbering Mouther "Blinding Spittle": half damage leaks on saved leg

**Verdict: FAIL(a) / DATA — one-field fix `dc_success:"none"`** (twin family MA-0768 / MA-0781 / MA-0622 / MA-0481, playbook §63).

## Row
`docs/monster-actions-manifest.json` MA-0839, stableKey `gibbering-mouther|actions|1`, aoe-save, DC 10 Dexterity, 2d6 Radiant, range "30 feet", recharge "5-6", conditions [blinded].

## Disk (public/data/monsters.json gibbering-mouther actions[1]) — FULL quote
```json
{"name":"Blinding Spittle","description":"Dexterity Saving Throw: DC 10, each creature in a 10-foot-radius <strong>Sphere</strong> centered on a point within 30 feet. Failure: 7 (2d6) Radiant damage, and the target has the <strong>Blinded</strong> condition until the end of the mouther's next turn.","save_dc":10,"save_type":"Dexterity","range":"30 feet","save_effect":"Failure: 7 (2d6) Radiant damage, and the target has the Blinded condition until the end of the mouther's next turn.","recharge":"5-6","damage_dice_primary":"2d6","damage_type_primary":"Radiant"}
```
`dc_success` **ABSENT**. Prose carries a FAILURE clause ONLY — no Success clause → RAW: a successful save = **zero effect, zero damage**.

## Code
`resolveBlockSaveDcSuccess` (src/components/encounter/MonsterCardModal.jsx:212-215): `action.save_dc != null ? (action.dc_success ?? 'half') : null` → absent field defaults `'half'`; SaveAttackAoeModal `computeDamageAfterEvasion(raw, success, dcSuccess, …)` pays floor(raw/2) on saves. Picker copy renders the leak verbatim: "On a successful save, target takes half damage." (MA-0030 comment block above the resolver already documents the authored-override seam — this row simply lacks the field.)

## LIVE proof (test-campaign, fresh session, 2026-09-22, dev :5173)
Rig: EB join exact "Gibbering Mouther"→"Gibbering Mouther 1" + Bandit 1 (AC12, resistances None) + Thug 1 (AC11, immunities []) — both radiant-clean (§75 bludgeoning-resist N/A). Victims cs maxHp/currentHp 999 full-store cs POST (§119/§120); picker seam full-word cs `saveBonuses.dexterity:-19` (§160) + nested `saving_throws.dex:-19` spare (§209).

FAIL legs (fire-1, -19 rig), 2 victims multi-target picker confirm "Blinding Spittle (2)":
- Bandit 1: saveRoll 10 +(-19) ✗ → rolls [1,3]=4, fd=4 FULL 2d6 Radiant, hp Δ−4 (999→995) |Δ|==fd exact; `condition applied` Blinded src Gibbering Mouther 1; activeConditions [blinded] + meta {dc:10, ability:dex, source} (§190/§191) — Blinded-te LIVE, twin precedent MA-0713/MA-0771.
- Thug 1: saveRoll 9 ✗ → [5,6]=11, fd=11 FULL, Δ−11 (999→988) exact; Blinded granted w/ meta.

Recharge economy (§61) LIVE: ability_use spend at picker-open ("Recharge 5-6; unavailable until a d6…"), chip class `mc-dice-link-spell-spent` (§100), re-click → "Not Recharged" popup verbatim + refused (not recharged) automation log, zero spend zero save; per-char `monsterRecharge` change-data `recharged:false→true` via full-store per-char POST re-arm (§239/MA-0782; §254 GET unwrap `g['<Name>']||g.value`).

SAVED legs (refire after re-arm, cs `saveBonuses.dexterity:+19` flip):
- Bandit 1: sr=**success** (saveRoll 6, +19 → 25≥10), damage roll [3,4]=7, **fd=3 = floor(7/2)**, hp 995→992 (Δ−3).
- Thug 1: sr=**success** (saveRoll 5, +19 → 24), damage roll [6,2]=8, **fd=4 = floor(8/2)**, hp 988→984 (Δ−4).
RAW demands ZERO damage + zero condition on saves → half damage paid = **half-on-success leak, both victims, applied to HP**. Zero NEW Blinded grants on saved legs (§96 clean — the leak is damage-only).

## Adjudication
- Fail legs damage+blinded live exact = PASS-subset axis (§211 parseable sphere shape + canonical "Blinded" word → picker grant live; no advisory-vs-FAIL adjudication needed — grants fired).
- Saved-leg half-leak = **FAIL(a)** per verdict rule + precedent MA-0768 (gazer Frost Ray half-on-success-leak) and MA-0781 (ghost Horrific Visage, same absent-dc_success-default-half, same picker route, -19/+19 full-word rig). MA-0622/MA-0481 family fix precedent.
- Recharge numbers/affordances all exact (§61 flat "5-6" live spend/refuse/re-arm) — not a defect axis.
- Residuals noted: §9 Cancel-keeps-paid (one orphan picker-open spend during stale-results-modal collision, accepted residual); stale modal replay cache (§77/§145); app console clean (sole error = harness route misfire §254, §158 attribution).

## Fix (DATA, one field)
Author `"dc_success": "none"` on gibbering-mouther actions[1] (byte-shape per MA-0481/MA-0622/MA-0781 family fixes; honest copy both surfaces — picker DamageNote prints "no damage" per SaveAttackAoeModal.jsx:1067). Then re-verify saved leg pays 0, fail legs byte-identical, no manifest re-stamp needed (orchestrator-owned §8).
