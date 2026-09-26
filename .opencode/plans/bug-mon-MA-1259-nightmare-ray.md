# MA-1259 — Oni / Nightmare Ray — FAIL(a)/DATA

**Date:** 2026-09-26 · **Campaign:** test-campaign · **Playbook:** §153 (MA-0291/0361 family), MA-1240 twin fingerprint, MA-0855 adjudication note

## Symptom (live)
Disk row `monsters.json` → `oni.actions[2]` (Nightmare Ray) authors prose "Hit: 9 (2d6 + 2) Psychic damage, and the target has the **Frightened** condition until the start of the oni's next turn" but has NO `hit_conditions` field. Live hits deal exact 2d6+2 Psychic and apply ZERO Frightened — no grant log, no `Bandit 1` change-data store key at all.

## Static disk re-confirm (step 1)
`oni.actions[2]` keys: name/description/attack_bonus 5/save_dc 0/save_type ""/save_effect ""/range "60 ft."/reach ""/recharge ""/damage_dice_primary "2d6 + 2"/damage_type_primary "Psychic" — `hit_conditions`, `hit_target_effect`, `hit_choice`, `escape_dc`, `automation` ALL ABSENT. Description byte-match vs manifest (disk carries `<strong>Frightened</strong>`; text otherwise identical). save_dc 0 + save_type "" + description contains NO save → correct no-save lane (RAW 2024 Nightmare Ray is attack-hit based; manifest `saveDc:0` is honest, not decoy-gated here). Manifest `conditions:["frightened"]` = scrape noise: no attack-row consumer reads row `conditions` (§153).

## Live rig
- EB native cb.click() exact-td rows: **Bandit** + **Oni** (filter Bandit → check Bandit; filter Oni → check Oni; pre-Join checked audit exactly `['Bandit','Oni']`) → explicit **Join Encounter** → cs: Oni 1 AC17 init 11, Bandit 1 AC12 init 1 HP11.
- Full-store `/combatSummary` POST (`{value:cs}`): Bandit 1 maxHp/currentHp 999 — GET-confirmed 999/999. NOTE: this build's cs GET wraps under `combatSummary` key (unwrap, re-POST wrapped).
- Arm: Oni 1 initiative-row own-card select via avatar-alt anchor (`img.avatar-image[alt="Oni 1"]` → closest card → select, prototype value setter + change dispatch, options self-exclude, Bandit 1 present). Server-confirmed `cs.creatures[Oni 1].targetName:"Bandit 1"`; TOP-LEVEL cs.targetName KEY-ABSENT (§MA-1258 refinement — arm audit on attacker creature dict only).
- Card: single `+5` chip on strong.startsWith('Nightmare Ray') row §116/§180 (Multiattack header carries bogus +7 §440 + a +0 junk, Shape-Shift/Spellcasting +0 §490 — all anchors avoided, never pressed).

## Hit ledger (8 presses, 7 HIT / 1 MISS, round 1 const, all chips first-click non-absorb)
| # | Result | d20 rolls | total=nat+5 (popup) | AC | damage | hp |
|---|---|---|---|---|---|---|
| 1 | HIT | [14,7] | 19 | 12 | "2d6 + 2" [5,3] → 10 Psychic | 999→989 |
| 2 | HIT | [12,10] | 17 | 12 | "2d6 + 2" [6,5] → 13 Psychic | 989→976 |
| 3 | HIT | [15,17] | 20 | 12 | "2d6 + 2" [6,6] → 14 Psychic | 976→962 (total-20 ≠ crit §452) |
| 4 | HIT | [8,12] | 13 | 12 | "2d6 + 2" [5,2] → 9 Psychic | 962→953 |
| 5 | HIT | [11,16] | 16 | 12 | "2d6 + 2" [1,5] → 8 Psychic | 953→945 |
| 6 | HIT | [17,9] | 22 | 12 | "2d6 + 2" [6,4] → 12 Psychic | 945→933 |
| 7 | HIT | [10,4] | 15 | 12 | "2d6 + 2" [6,5] → 13 Psychic | 933→920 (§77: damage-die pool echoes press 2 but attack second-die differs [10,4] vs [12,10] + own popups = honest fresh rolls §1227) |
| 8 | MISS | [2,7] | 7 | 12 | none (zero damage entry, zero hpΔ) | — |

- 7/7 damage entries formula `"2d6 + 2"` Psychic byte-exact, `finalDamage==rolls+2` every entry, `isCrit:false` ×7, single-primary (secondary* keys absent §185), `combined_damage_roll` note absent.
- Σfd 79 == 999−920 == cs currentHp truth, unclamped §181.
- Miss lane: nat2→7 ✗ popup DONE = `.popup-close-btn`, pressing applies nothing (MA-1228/1255 build-current); lastAttack hit:false/total:7.
- Attack logs: `total`=raw nat on this seam (popup prints nat+bonus) — judged by hit:true/targetAc §1247; `rangeReason:null` ×8, `range` key ABSENT on attack logs — gridless-lenient single-number fingerprint §146/§147 (`parseRangedBand` needs "N/M" band → null `buildRangedBandAdvisory` Helpers:949-954; 60 ft honored by absence of grid gate, not by consultation).
- `lastAttack.saveDc/saveType:null` on every press §156 (no save lane; correct vs RAW hit-based row).

## Grant-state evidence (all zero → FAIL(a))
- Whole-log scan: `type:'condition'` entries **0**; `/fright/i` mentions **0** (log len 25 = join noise + initiative ×2 + 8 attack + 7 damage entries).
- `GET /change-data` top keys: `combatSummary, __campaign__, __map__, AasimarTest, activeCreatureName, combat-ui-viewingMonster*, Oni 1, lastAttack` — **NO `Bandit 1` store key** = strictest zero-grant discriminator (§1116/MA-1240 twin): `applyHitClauseConditions` never ran against the victim.
- Top-level + victim-level `activeConditions`/`activeConditionMeta`/`targetEffects`: KEY-ABSENT. Oni 1 cd keys only lastAttackRoll/_lastRollContext/pendingCombatSuperiorityPrompt; Oni targetEffects KEY-ABSENT.
- Console: 0 errors whole session.

## Grep proof (§153 byte-cites)
- `src/components/encounter/MonsterCardHelpers.js:673-680` — `buildHitConditionClause(action)` reads **only** `action.hit_conditions` (:675); absent on oni row → `conditions:[]`, no targetEffect, no conditionRoll → returns `null` (:678) → clause never armed.
- `src/components/encounter/MonsterCardModal.jsx:874` — `hitClause: buildHitConditionClause(action)` feeds attack context.
- `src/hooks/combat/handlers/handlePlainDamage.js:543` — `applyHitClauseConditions` = canonical grant (activeConditions + meta + `condition applied` log); early-return `if (!hitClause …) return` :612-613 → never fires. Live consumer twins: MA-0010 / MA-0877 (poisoned) / MA-1240 (charmed).
- Manifest/prose-side: row-level `conditions` grep-zero consumers on attack path; prose Frightened never parsed for attack hits (extractConditionsFromSaveEffect consumes `save_effect` only).

## MA-0855 adjudication note (took-damage-clears)
Engine-wide rule (playbook :108): Charmed/**Frightened** grants end same-hit via applyDamage took-damage-clears (2024 charmed RAW adjudication). Here the rider is hit-based with damage on the SAME attack, so even after the one-field fix, any Frightened grant would be adjudicated at pick/apply-time via change-data — expect the took-damage clears rule to interact; if post-fix verification shows grant-then-immediate-clear, judge by grant log + meta presence at Done vs post-apply state, per MA-0855 precedent (zero grants make this MOOT today: the grant itself never fires because `hit_conditions` is unauthored).

## Fix (one field, MA-0010 byte-shape)
Add to `oni.actions[2]` in `public/data/monsters.json`:

    "hit_conditions": ["frightened"]

No code change (consumer live §153). Duration "until the start of the oni's next turn" rides standard hit-clause meta stamping (escape_dc NOT applicable — not a grapple); sustained-duration expiry clock residual = MA-0287/0361 family advisory. MA-1257 twin note stands: Frightened rider gap flagged at Multiattack/Claw pass, this row is the rider's own row.

## Cleanup
Admin POST `/admin/clear-change-data` + `/admin/clear-log` → 200/200; +15s GET log `[]` cd `[]`; quiet-recheck +5s still log 0 / cd 0 keys. test-campaign only.
