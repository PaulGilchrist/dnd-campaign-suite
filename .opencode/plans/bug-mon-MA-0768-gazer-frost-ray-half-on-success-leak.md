# Bug MA-0768 — Gazer "3. Frost Ray": SUCCESSFUL save pays HALF damage (RAW: zero)

## Verdict
FAIL(a) — DATA fix, one field: `dc_success:"none"` on `public/data/monsters.json` gazer `actions[4]` ("3. Frost Ray"). MA-0481/MA-0622 family (§63/§126 MV-20 half-default leak).

## Canonical RAW
Gazer Frost Ray: "The targeted creature must succeed on a DC 12 Dexterity saving throw or take 10 (3d6) cold damage." — damage on FAIL ONLY. No "Success: half damage" clause in disk description, save_effect, or canonical 5e text. Correct `dc_success` = `"none"`.

## Disk (public/data/monsters.json, gazer actions[4])
```json
{ "name": "3. Frost Ray",
  "description": "The targeted creature must succeed on a DC 12 Dexterity saving throw or take 10 (3d6) cold damage.",
  "save_dc": 12, "save_type": "Dexterity",
  "save_effect": "The target takes 10 (3d6) Cold damage.",
  "damage_dice_primary": "3d6", "damage_type_primary": "Cold" }
```
`dc_success` key ABSENT → app default-half fires.

## Likely location (default-half consumers, byte-identical MV-20 convention)
- `src/components/encounter/MonsterCardModal.jsx:213-214` `resolveBlockSaveDcSuccess`: `action.save_dc != null ? (action.dc_success ?? 'half') : null` — the ray block-save route.
- `src/components/encounter/MonsterCardModal.jsx:933` `buildSaveOptions` — same `?? 'half'`.
- `src/components/encounter/MonsterCardModal.jsx:1823` attack-chip save ride — same `?? 'half'`.
- `computeDamageAfterSave` (`src/services/rules/combat/applyDamage.js:88`) is safe-on-undefined (success → 0); the leak is the upstream `'half'` stamp reaching the NPC inline seam. Fix DATA, not code.
- Stale-pin scan: no test pins gazer actions[4] dc_success undefined ("Frost Ray" tests are spellThief/zealousPresence label fixtures); `dc_success:'none'` byte-shape precedent pinned at `MonsterCardHelpers.gaze-immunity.test.js:21`.

## Live ledger (dev :5173, test-campaign header-verified, 2026-09-21)
EB exact joins: Bandit 1 (cs idx0, init19), Gazer 1 (idx1). Bandit maxHp/currentHp 999 via full-store cs POST. Target armed on Gazer own initiative-card target-select. Ray chips land FIRST click (MA-0766/0767 family re-confirmed, no §138 absorb, 2/2).

FAIL leg (`saving_throws:{dex:{modifier:-5}}`, §209 nested-abbrev):
- popup: "✗ SAVE FAILURE (5 vs DC 12)" ; log `roll save`: sr:"failure", saveDc:12 ✓, saveType:"Dexterity" ✓, bonus:-5 folded (nat10→total5), dcSuccess:"half" (leak visible).
- `save-damage`: fd:13, rolls [1,6,6] = FULL 3d6 ✓ ; hp_change 999→986 Δ13 == fd ✓.

SUCCESS leg (flip `saving_throws:{dex:{modifier:+19}}`):
- popup: "✓ SAVE SUCCESS (39 vs DC 12) … 6 damage applied to Bandit 1 — HP: 986 → 980".
- log `roll save`: sr:"success", sdc:12, st:"Dexterity", b:19, nat20, total 39, **dcSuccess:"half"**.
- `save-damage`: **ss:true, fd:6** = floor(raw 12/2) — RAW demands **0**. hpΔ 986→980 == 6 (clean unclamped, not a death-clamp artifact §33).

## Fix
Add `"dc_success": "none"` to gazer actions[4] (place after `damage_type_primary`, match MA-0481/MA-0622 byte-shape). Both surfaces then honest: failure full, success zero. Prose copy already canonical (no success clause).
