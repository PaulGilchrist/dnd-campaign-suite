# Bug — MA-0962 Half-Dragon Claw (half-dragon | actions | 1)

**Verdict: FAIL(a)-DATA** — core numerics exact; "plus 7 (2d6) type-chosen" rider inert-by-construction (§118, MA-0530 family; one-field-fix MA-0325/0871 lineage).

## Expected (manifest row)
> "Melee Attack Roll: +7, reach 10 ft. Hit: 6 (1d4 + 4) Slashing damage plus 7 (2d6) damage of the type chosen for the Draconic Origin trait."

Hit should deal 1d4+4 Slashing **plus 2d6 of the Draconic-origin type**.

## Actual (live, test-campaign, 2026-09-23)
Core PASS numerics, rider never rolls:

- Press 1: attack nat 6 +7 = 13 ≥ AC 12 → HIT ✓. Damage `1d4 + 4` rolls [4]+4 = **8 Slashing**, finalDamage 8 == |hp_change −8| (Bandit 276→268). Breakdown: Slashing only, resisted:false.
- Press 2: attack nat 13 +7 = 20 ≥ AC 12 → HIT ✓. Damage `1d4 + 4` rolls [1]+4 = **5 Slashing**, fd 5 == |Δ−5| (268→263). Breakdown: Slashing only.
- Flat +4 applied once per hit (exact); no nat20/nat1 occurred (6, 13) — crit variant unexercised, recorded.
- **Rider inert evidence — live popup dumps:**
  - Stage-1 (press 1): `Claw | 13 | d20 6 +7 (+7 to hit) | Advantage | Disadvantage | ✓ HIT (13 vs AC 12) | Done | click to dismiss` — NO second "2d6" pool, NO type chooser.
  - Stage-2 (press 1): `Claw | 8 | 1d4 + 4: 4 +4 | 8 damage applied to Bandit 1 — HP: 276 → 268 | click to dismiss` — has2d6:false, no choose/type text.
  - Stage-1 (press 2): `Claw | 20 | d20 13 +7 … HIT (20 vs AC 12)` — has2d6:false. Stage-2: `Claw | 5 | 1d4 + 4: 1 +4 | … 268 → 263` — has2d6:false.
  - Damage ledger entries: `note:"combined_damage_roll"` (cosmetic §183) with **zero keys matching /secondary/** — secondaryFormula / secondaryFinalDamage ABSENT (empty secondary dict). No elemental type ever appears in damageBreakdown.
- §119: ONE "+7" chip on Claw row (SPAN.mc-dice-link); Multiattack row mirrors +7 (§142) — Claw row anchored via strong.startsWith('Claw'), clicks isolated to Claw row.
- Toggle audit: [role=switch]=0, [role=radiogroup]=0, [role=tablist]=0 on card overlay and both popup stages — no type/mode chooser machinery.

## Grep evidence
- Disk Claw row keys (public/data/monsters.json actions[1]): name/description/attack_bonus:7/reach:"10 ft."/damage_dice_primary:"1d4 + 4"/damage_type_primary:"Slashing" — **no damage_dice_secondary, no flat_damage_secondary**.
- MA-0531 transport LIVE: `buildSecondaryDamageTransport` (src/components/encounter/MonsterCardModal.jsx:879) stamps `secondaryFormula` **only** from authored `damage_dice_secondary || flat_damage_secondary`; absent → `{autoDamageSecondaryFormula:null}` byte-inert. Consumers: MonsterCardModal.jsx:338 (pickerSecondaryFields), :859/:996/:1358; handlePlainDamage.js:337 `rollAndApplySecondaryPlainDamage` + :360 `note:'combined_damage_roll'`. Un-fed for Claw ⇒ rider structurally cannot transport.
- Draconic-origin type machinery: grep src/+server/ `draconic origin|draconicOrigin` = **zero**. "draconic" hits are PC-side only (Dragonborn ancestry resistances, featureCategories). §8 variant chooser is animal-spirit-only. No machinery could hold the dynamic type even if dice were authored without a type.
- Ledger: 196→202 = +6 exact (2 × [attack, damage, hp_change]); 0 console errors.

## Steps to reproduce
1. localhost:5173 → test-campaign → Initiative (rig: Half-Dragon 1 AC18 105/105, Bandit 1 AC12 staged 999).
2. Open Half-Dragon 1 card; own initiative-card target select = Bandit 1.
3. Press Claw "+7" chip (row-anchored strong.startsWith('Claw'); Multiattack +7 mirror untouched).
4. Done → observe: single 1d4+4 Slashing pool only; "plus 7 (2d6)" never rolls; no type chooser at any stage.

## Likely Location
`public/data/monsters.json` — Half-Dragon actions[1] (Claw): one-field DATA fix `damage_dice_secondary: "2d6"` per MA-0531 MA-ints (consumers live). **Caveat:** `damage_type_secondary` cannot be a static value — type is dynamic ("type chosen for the Draconic Origin trait"); needs an origin-trait chooser design (see Notes) or at minimum the composite-label honest-copy pattern.

## Notes
- Siblings sharing "type chosen for the Draconic Origin" defect in monsters.json — count **2**, both same monster, both secondary ABSENT:
  1. Half-Dragon actions[1] **Claw** (this row; secondary ABSENT)
  2. Half-Dragon actions[2] **Dragon's Breath** (8d6 save row; secondary/type ABSENT — MA-0963 owns)
- Draconic Origin trait (disk trait) is DM's-choice text only — no machine field (e.g. `draconic_origin_type`) anywhere; §8 variant chooser is animal-spirit-only, so a per-monster origin instance type does not exist in the model. Full fix = origin-trait chooser design ticket; minimal inert-rider fix = author `damage_dice_secondary:"2d6"` with composite/honest type label (§70-class advisory, MA-0672/0690 twins).
- MA-0961 Multiattack pressed same rig today: PASS-subset, core exact, elemental 2d6 clause prose-only NEVER rides — this row now owns that advisory and confirms it: rider confirmed inert here on its own chip.
- Rig intact after run; cleanup: no clears. **Bandit HP drift: 276 → 263 (−13 = 8+5)**; Half-Dragon 105/105 untouched; target still Bandit 1; combat round 1.
- campaign = test-campaign only; header verified post-select and in final state.
