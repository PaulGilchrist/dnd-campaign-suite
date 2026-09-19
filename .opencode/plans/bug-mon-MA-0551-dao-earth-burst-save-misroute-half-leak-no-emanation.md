# bug-mon-MA-0551 — Dao Earth Burst: attack-hit mis-routed into save-damage, half-leak on success, wrong save dice, inert Emanation

Row: MA-0551, Dao (monsters.json actions[2]), attack+save, +10 ranged 120 ft., Hit 15 (2d8+6) Bludgeoning; Hit-or-Miss: 10-ft Emanation from target, DC 16 DEX, Fail 10 (3d6) Thunder, Success none.

## Verdict: FAIL (a) — data+seam

## Live evidence (test-campaign, Dao 1 vs Knight AC18 + Bandit 1 both HP-staged 999)
1. Attack chip (+10) routes the FIXED hit damage through the save-damage seam:
   - MISS nat4+10=14 vs AC18: clean, zero damage (attack-bonus leg itself honest).
   - HIT nat8+10=18 (boundary): stage-2 popup adjudicates `✗ SAVE FAILURE (7 vs DC 16)` and pays 2d8+6 ([8,4]+6=18), hp 999→981. Numerically RAW-exact only because the Knight failed the save that should not exist; a nat16+ Knight would halve RAW-fixed hit damage (dc_success ABSENT → default 'half').
2. `DC 16 Dexterity` save chip fires first-click; Knight nat18+0=18 ✓ SUCCESS still paid HALF: rolls [4,7]=11+6=17 → finalDamage 8, hp 981→973. RAW save success = ZERO damage → MV-20/MA-0481 half-leak twin.
3. Save-leg dice/type wrong on BOTH legs: `2d8 + 6 Bludgeoning` (primary) — the 3d6 Thunder from save_effect prose is never extracted. Zero Thunder damage entries app-log.
4. Emanation rider inert: `range_save` has grep-zero consumers; no AoE picker opened; Bandit 1 never rolled; RAW requires every creature in 10 ft (incl. target) to save (MA-0317 no-parse class).

## Producer/consumer seams (disk-checked)
- `MonsterCardModal.jsx:678-682` buildSaveOptions: save_dc/save_type ride EVERY attack roll option; `dcSuccess` defaults `'half'` when row omits dc_success.
- `MonsterCardModal.jsx:725` buildAttackRollOptions spreads buildSaveOptions onto the compound attack chip; `:1248-1251` autoDamage context carries saveDc.
- `useLoggedDiceRollDamage.js:139-141`: any NPC damage context with saveDc+saveType → npcSaveDamageHandler (save adjudication of attack-hit damage).
- `MonsterCardModal.jsx:477-482` extractDamageDiceFromDescription returns `damage_dice_primary` verbatim; no parser reads dice from save_effect ("Failure: 10 (3d6) Thunder damage.").
- `handleNpcSaveDamage.js:222/248` applyFailedSaveConditions/applyNpcFailedSaveLegs consume `statusEffects` only (§105).

## Fix
DATA (row): add `dc_success:"none"`; author `damage_dice_secondary:"3d6"` + `damage_type_secondary:"Thunder"` (MA-0427 transport live) or add save_effect-damage parser; keep attack-damage fixed.
CODE (seam): composite fork — when row has attack_bonus AND save_dc, the attack chip must NOT arm save_dc on its auto-damage (buildAttackRollOptions composite branch); save_dc should drive a separate emanation/secondary leg (MA-0317 picker ticket).

## Ledger
2 attack rolls (1 miss nat4, 1 hit nat8+10=18 AC18 boundary), 2 save-damage legs (fail 18 exact / success paid 8 HALF), 1 victim save success nat18+0, 2 hp_change −18/−8 Knight; zero condition, zero Thunder, zero emanation/multi-target entries.

Cleaned: admin clear change-data+log, log-len 0 verified quiet.
