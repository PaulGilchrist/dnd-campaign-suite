# Bug — CLA-029 Battering Roots: reach +10 applied to ALL melee weapons (Heavy/Versatile condition has no consumer); extra-mastery chooser logged as "Tactical Master"

## Overview
CLA-029 Battering Roots (Barbarian, Path of the World Tree, level 10, 2024 ruleset) was verified live on host **DraconicDragon** (lv20 Barbarian, subclass switched to Path of the World Tree, STR +5 PB +6, Longsword [Versatile/Sap] + Shortsword [Light/Finesse/Vex] equipped) vs EB-joined **Thug 1** (AC 11, HP 32) on active map **battle-arena**.

Two defects:
1. **PRIMARY (a) FAIL — weapon-property gate absent:** the reach +10 bonus applies to *every* melee attack, including non-Heavy/non-Versatile weapons. A Shortsword hit Thug 1 at 15 ft, and an auto-miss at 25 ft carried the reason text **"(25 ft > 18 ft)"** — 18 ft = base melee 8 ft + the un-gated 10 ft Battering Roots bonus.
2. **SECONDARY — feature misattribution in chooser + log:** the on-hit Push/Topple chooser works (Sap auto-applied AND Push additionally offered/applied — the "in addition to" behavior is correct in state), but the modal header is the Fighter's "Tactical Master — Longsword" with Fighter prose ("replace that property with the Push, Sap, or Slow property"), and the ability_use log reads "used **Tactical Master** on Longsword ... **changed mastery from Sap to Push**" — wrong feature name, and the replace-wording is false (both Sap AND Push landed on the target).

## Expected (canonical data quote, public/data/2024/classes.json:1081-1096, Path of the World Tree, level 10)
> "During your turn, your reach is 10 feet greater with any Melee weapon that has the Heavy or Versatile property... When you hit with such a weapon on your turn, you can activate the Push or Topple mastery property **in addition to** a different mastery property you're using with that weapon."

automation: `{type:"passive_buff", effect:"extra_reach", bonus:"10 ft", condition:"heavy_or_versatile_melee_weapon", extraMastery:["Push","Topple"]}`

- Reach +10 ONLY when attacking with a Heavy or Versatile melee weapon; all other melee attacks keep the 8 ft cap.
- On hit with Longsword (Versatile): weapon's own mastery (Sap) applies AND a Push/Topple chooser appears; choosing one additionally applies it. Logging should attribute the feature (Battering Roots), not Fighter's Tactical Master.

## Actual
- (a) FAIL: Shortsword (not Heavy/Versatile) attack at 15 ft rolled `mode:normal` and HIT (log roll d20 [12,5]+11 vs AC 11). At 25 ft: auto-miss `rangeReason:"Target out of melee range (25 ft > 18 ft)"` — cap is 8+10 even for the Light/Finesse Shortsword ⇒ `condition:"heavy_or_versatile_melee_weapon"` is never consulted. `heavy_or_versatile` is **grep-zero in src** (producers-only data field).
- (b) PASS: Longsword at 15 ft `lastAttack.hit=true, rangeReason:null, mode normal` (cap 18 ft active); damage ledger exact: `1d8+5 [slashing]: 1+5 = 6`, Thug 32 → 26.
- (c) PASS-in-state / FAIL-in-attribution: on hit, `targetEffects` held **both** `{source:"Sap", effect:"disadvantage_next_attack", until_start_of_next_turn}` and `{source:"Push", effect:"push", value:10, instant}`; ability_use logs "DraconicDragon applied Sap to Thug 1" + "used Push on Thug 1 — pushed 10 feet straight away." But the chooser modal rendered as "Tactical Master — Longsword ... replace that property with the Push, Sap, or Slow property" (options were correctly Push/Topple, source "Feature"), and the spend log said "used **Tactical Master** on Longsword — **changed mastery from Sap to Push**" (Sap was NOT removed).
- Sheet display: attack rows still print "Range 5 ft." for Longsword (no +10 reach surfaced on the sheet; enforcement-only).

## Steps to Reproduce
1. `npm run dev`, open http://localhost:5173, select **test-campaign**.
2. Edit DraconicDragon → step 7 Subclass = **Path of the World Tree**; step Inventory → Equipped = `Longsword, Shortsword`; Save (≈15 s disk-verify).
3. Sheet → Weapon Mastery row → tick Longsword + Shortsword → Select (kind bucket needed for base Sap).
4. Encounters → search **Thug** → Join Encounter. Maps → Battle Arena → Activate → Open. Place/keep Dragon token (5,9), Thug 1 NPC token (8,9) = 15 ft (drag via real mouse; 40 px cells).
5. Initiative → walk Next to DraconicDragon → arm his card Target = Thug 1.
6. Click Shortsword "+11" chip → Normal Attack → HIT at 15 ft (BUG: should be pre-roll auto-miss ≤8 ft).
7. Drag Thug to (10,9) = 25 ft → Shortsword chip → AUTO-MISS popup "Target out of melee range (25 ft > **18 ft**)".
8. Drag back to (8,9) → Longsword chip → Normal Attack → Done → damage 6 + "Tactical Master — Longsword" chooser offering Push/Topple → Apply Push → Sap + Push both on target; log line mislabeled "Tactical Master ... changed mastery from Sap to Push".

## Likely Location
- `src/services/character/featRangeService.js:14-22` — `applyPassiveRanges` reads `passive.effect === 'extra_reach'` and `bonusExpression` into `meleeReachBonus` **without inspecting `passive.condition`** (`"heavy_or_versatile_melee_weapon"`); consumed ungated by `src/services/automation/contextBuilder-map.js:188-199 applyRangeEffect` → `src/services/rules/combat/rangeValidation.js:53-62` (melee cap `MELEE_RANGE_FT + meleeReachBonus` for any melee attack). Fix needs the attacking weapon's properties threaded into the reach computation (attack row → computeRangeEffect), or a per-weapon gate before applying the bonus.
- `src/components/char-sheet/useCharActionsCleave.js:145-160 handleTacticalMasterConfirm` + `src/components/char-sheet/modals/TacticalMasterModal.jsx` — chooser/confirm is the shared Fighter "Tactical Master" seam; for Battering Roots choice-mode it should be titled/logged as Battering Roots and worded "in addition to" (the replace claim is false — `applyAutoMasteries` keeps base mastery applied).

## Notes
- Manifest handler/router/infoBuilder paths (`classFeatureHandler/Router/classFeatureInfoBuilder`) do not exist; real chain: automationCollector → automationInfoBuilder/passive.js (bonusExpression = `auto.bonus`) → `playerStats.automation.passives` → featRangeService + automationPassives.collectWeaponMastery (CHOICE_MASTERY_NAMES Push/Topple → choiceMasteries → modalOptions) → attackRollPostDamage buildTacticalMasterStep.
- The "in addition" half is genuinely live (both te coexist) — only gate (a) and attribution are broken.
- Ledger noise (absorbed-first-click family §101/§148): two Longsword attack-roll entries, one damage entry — count damage not rolls.
- Control probes: non-HV weapon delta = definitive ungating; grid positions confirmed active (`rangeReason` stamps prove non-lenient mode).
- Kind gate (WM-008) must be armed (Longsword in `_Weapon_Kind_Mastery_chosenWeapons`) or base Sap is stripped and the weapon "has no mastery in use" — RAW's "different mastery you're using" then has no base.
