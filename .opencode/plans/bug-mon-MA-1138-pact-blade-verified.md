# MA-1138 Marilith Pact Blade — LIVE VERIFICATION (2026-09-24)

## Row
MA-1138 / marilith / actions[1] "Pact Blade", attack_bonus 10, save_dc 0, save_type "".
"1d10 + 5" Slashing + secondary "2d6" Necrotic, reach 5 ft. Pure attack; NO save prompt allowed.

## Static (public/data/monsters.json)
Disk row byte-matches provided row JSON. save_dc:0/save_type:"" → no save lane.

## Setup (UI-only)
- Header verified `test-campaign` after every nav (§158 URL-bar nav re-dropped to campaign select — click nav instead).
- No standing init (MA-1137 cleanup) → EB join Marilith x1 + Bandit x1 (checkbox+qty1 exact-match rows, pre-Join checked-enumeration §442 clean).
- Bandit 1 rigged via init-card aria inputs fill()+Enter BEFORE stat card: current/max HP inputs → 999/999 (max accepted 999 this run; hp_change log still stamps authored maxHp:11 cosmetic §442).
- Armed Bandit 1 on Marilith 1 OWN init-card select (native setter+change, sticks). Round stayed 1 for all 8 fires (§148 same-turn).

## Row affordance (img.avatar-image[alt="Marilith 1"] → .mc-overlay, strong.startsWith('Pact Blade'))
- Row text byte-exact description (+ cosmetic trailing "()" §445 twin).
- EXACTLY ONE chip "+10" (span.mc-dice-link[role=button]); .mc-dice-link-save EMPTY — zero DC chip. No save prompt ever opened.

## Fresh fires (8, all same round vs Bandit 1 AC12)
| # | nat | popup total | dmg "1d10 + 5" | fd | sec "2d6" rolls→total | fd+sec | hpΔ | curHp |
|---|-----|-------------|----------------|----|------------------------|--------|-----|-------|
| 1 | 9 | 19 HIT | [4] | 9 | [2,5]→7 | 16 | −16 | 999→983 |
| 2 | 16 | 26 HIT | [2] | 7 | [1,5]→6 | 13 | −13 | 983→970 |
| 3 | 12 | 22 HIT | [5] | 10 | [6,5]→11 | 21 | −21 | 970→949 |
| 4 | 9 | 19 HIT | [7] | 12 | [4,4]→8 | 20 | −20 | 949→929 |
| 5 | 13 | 23 HIT | [10] | 15 | [1,6]→7 | 22 | −22 | 929→907 |
| 6 | 20 CRIT | "30 vs AC 12, DAMAGE DICE DOUBLED" | "1d10*2+5 (2)"→9 (mod +5 NOT doubled §32) | 9 | rolls[6,3]→18 (×2) | 27 | −27 | 907→880 |
| 7 | 1 NAT1 | MISS | no dmg/hp entries ✓ | — | — | — | — | 880 |
| 8 | 2 | "12 vs AC 12" boundary HIT | [2] | 7 | →5 | 12 | −12 | 880→868 |

- Every fire: log-delta = exactly attack+damage+hp_change triple (§442), popup Done via button.dice-roll-reroll-btn.
- fd+sec == |hpΔ| exact every hit. Σdmg 131 = 999−868 exact. damageBreakdown [Slashing,Necrotic] byte-exact amounts.
- Attack logs total=nat only, bonus:10 separate (§881 family).
- Crit: dice doubled, flat +5 NOT doubled (§32 ✓). Crit secFormula label stays "2d6" while total doubled to 18 — cosmetic formula-label asymmetry (§414/§189 family), amounts exact.

## Cleanup
Admin "Clear Change Data" + "Clear Campaign Log", confirms auto-accepted (page.once; handle_dialog "no modal" error = accept proof §444). Verified post: change-data `{}`, log len 0.

## VERDICT: PASS
ONE +10 chip, zero DC chips, no save prompt; 8 fresh fires incl. crit (§32 exact) and nat1 honest miss; all damage byte-exact dual-type ledgers; HP chain exact.
