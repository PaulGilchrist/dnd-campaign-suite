# BUG MA-1890 — Fenrir "Devour (Recharge 5-6)": grapple prerequisite gate absent + recharge gate absent (core save/damage exact)

## Overview
Row MA-1890 (fenrir|actions|3, save, DC 26 Strength, 6d10+10 Piercing, Recharge 5-6, target: creature Fenrir has Grappled). Live E2E test-campaign :5173 verified the CORE numerics exactly (DC 26 STR prompt, full damage on fail ×3, exactly-floored-half on success, exact unclamped HP ledger). However the **Grappled prerequisite gate is entirely absent** (row authors no `target_prerequisite`; fired 4/4 vs an activeConditions:[] victim with zero refusal, grappled face byte-identical) and the **Recharge 5-6 gate is entirely absent** (row authors no `recharge`; 5 fires across two turns, zero refusal, zero spend, zero recharge keys, no recovery d6 at owner turn-start). Per §1 verdict policy and MA-1843/MA-1847/MA-0663 precedents: **FAIL(a)/DATA**, two-field fix, core save/damage documented verified-good.

## Expected
- DC 26 STR save, single Huge-or-smaller Grappled creature; fail full 6d10+10 Piercing, success half. ✔ verified live.
- Refuse vs NOT-grappled target with `devour_refused` popup+log zero-roll (§209 MA-0019 gate lane lives in handleSaveRoll — evaluateTargetPrerequisiteGate MonsterCardHelpers.js:938, call-sites MonsterCardModal.jsx:2137/2273). ✘ gate null.
- After use: unavailable until d6 5-6 at Fenrir's turn-start, spend at fire, `<slug>_refused (not recharged)` (§61 consumers live). ✘ never armed.

## Actual
- Prerequisite: fired vs activeConditions:[] shot 1 + shot 2 (pre-grapple) with zero refusal popup, zero refusal log; grappled face (shot 4, meta source Fenrir 1) adjudicated identically → gate grapple-insensitive.
- Recharge: 5 prompts fired (shots 1,2 same turn; shot 5 on Fenrir's own turn post turn-start walk). change-data: zero recharge keys top-level AND `Fenrir 1` keys = [lastSaveRoll,_lastRollContext,pendingExpirations] only (§246 generic scaffold). Zero automation entries app-wide in log (`automationEntries: []`), zero refusal tokens, no turn-start recovery d6.
- No ability_use spend for Fenrir/Devour in log (MA-1843 twin).

## Repro (test-campaign, :5173, 2026-10-11)
1. EB exact-filter "Fenrir" join → Fenrir 1 cs idx0 AC23 HP629 init17 round:1.
2. Seed ElderPaladin via POST /api/campaigns/test-campaign/ElderPaladin {ElderPaladin:{hitPoints:224,activeConditions:[],activeBuffs:[{effect:'warding_bond',saveBonus:-7}]}}; disk-confirm.
3. Arm ElderPaladin on Fenrir 1's OWN initiative-card [data-testid="target-select"] — cs targetName server-confirmed.
4. Card row idx6 "Devour (Recharge 5-6)" renders TWO chips: `.mc-dice-link` "6d10 + 10" + `.mc-dice-link-save-clickable` "DC 26 Strength". Native el.click() on save chip lands 5/5 first click (zero absorb this session).
5. PC prompt `.sp-modal` "STRENGTH saving throw DC 26, Half damage on successful save" — NOT-grappled victim fired immediately, no prerequisite refusal.
6. Done = `.sp-roll-btn` (prompt seam), stage-2 result popup "click to dismiss | Done".

## Ledger (machine truth)
- Shot 1 (NOT grappled, wb −7): nat19 +3 = 22 ✗ → raw [9,6,6,6,10,3]+10 = 50 FULL → hp 224→174 (Δ50 exact)
- Shot 2 (same turn, NOT grappled): nat10 +3 = 13 ✗ → raw [8,8,3,10,9,7]+10 = 55 FULL → hp 174→119 (Δ55 exact)
- Shot 3 (wb +15 success rig): nat3 +25 = 28 ✓ → raw [6,5,10,1,6,10]+10 = 48, finalDamage 24 = floor(48/2) EXACT → hp 119→95
- Shot 4 (grappled via full-store POST, meta {source:Fenrir 1,dc:20,str}): nat19 +3 = 22 ✗ → 47 FULL → hp 95→48
- Chain: 224−50−55−24−47 = 48 = epHp final, unclamped; dc_success default `half` = RAW-correct (row authors none).
- saveResult-ElderPaladin samples: {success:false,roll:19,total:22,saveBonus:3,mode:normal,bonusDetail:"(+5 aura)"} / {success:true,roll:3,total:28,saveBonus:25,bonusDetail:"+15 [Warding Bond]"} — §76 wb rig live at PC prompt seam.
- save_result ×4 + hp_change ×4 log-exact; automation 0; refused-token grep 0.

## Likely Location / Fix
- `public/data/monsters.json` fenrir actions[3]: add `recharge: "5-6"` (MA-0031/0488/0618 consumers live; rechargeUsageOf monsterRecharge.js:35 name-text unparsed — MA-0663/MA-1843 fingerprint) + `target_prerequisite: {conditions:["grappled"], by_attacker:true}` (MA-0019 byte-shape; gate live at handleSaveRoll — §209/MA-1847 twin conversion: prose "creature Fenrir has Grappled" = FAIL(a)/DATA one-field).
- RAW note: Fenrir authors NO grapple attack (Bite/Claw lack hit_conditions — MA-1888 note), so with the gate enforced Devour becomes GM-grant-only reachable in-app; durable fix should also decide grapple provenance (Bite hit_conditions+escape_dc MA-0010 shape, separate ticket).
- Devour grants no grapple itself (condition input, not output) — consistent, advisory.

## Verdict
FAIL(a)/DATA — core save adjudication VERIFIED-EXACT (DC/type/full/half/ledger); prerequisite gate ABSENT (MA-1847 twin) + recharge gate ABSENT (MA-1843/MA-0663 twin); two-field DATA fix, consumers live.

## Cleanup
- Admin clear change-data + log (curl, no dialogs §124), API-confirm; server :80+:5173 up.
