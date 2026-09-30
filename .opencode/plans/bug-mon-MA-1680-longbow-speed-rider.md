# BUG MA-1680 — Warrior Commander / Longbow (actions[2]): Speed-decrease rider inert (live-unarmed te lane)

## VERDICT: FAIL(a)/DATA — one-field fix `hit_target_effect:"speed_reduction"` (MA-0995/MA-1147 byte-twins) — core attack axes PASS exact

## Row (public/data/monsters.json warrior-commander actions[2])
- keys ONLY name/description/attack_bonus/range/damage_dice_primary/damage_type_primary
- attack_bonus 9, range "150/600 ft.", damage_dice_primary "3d8 + 5", damage_type_primary "Piercing"
- desc byte-match manifest TRUE: "Ranged Attack Roll: +9, range 150/600 ft. Hit: 18 (3d8 + 5) Piercing damage, and the target's Speed decreases by 10 feet until the end of the target's next turn."
- avg 3d8+5 = 13.5+5 ≈ 18 ✓ manifest damageDicePrimary
- Rider keys ALL ABSENT: hit_target_effect, hit_conditions, conditional_damage, hit_choice, damage_dice_secondary, save_dc/save_type/save_effect, automation.

## Core axes LIVE — PASS exact (dev:locked :5173, test-campaign, 2026-09-30)
- Board: EB exact-td join "Warrior Commander" CR10 (cs idx0, mi warrior-commander ac18 hp161 disk-exact) + "Bandit" → "Bandit 1" (cs idx1 ac12). cs full-store POST {value:cs} (§491) both HP×4 999 + Bandit resistances:[] + targetName "Bandit 1" SAME POST; double-unwrap readback EXACT (§MA-1645).
- Card (§442): Multiattack header 0 chips (omitted-bonus twin), Greatsword 1×"+9", Longbow 1×"+9" (row-scoped strong.startsWith('Longbow') anchor §693/§694 — Greatsword "+9" twin trap avoided; Counterattack 0 chips, never pressed), zero save/DC chips (no save_dc disk).
- LIVE press ledger (8 adjudicated real-pointer presses, fresh rect each §442), Bandit 1 AC12 vs +9:
  | press | d20 | total | vs AC | hit | rolls | formula | fd | hp |
  |---|---|---|---|---|---|---|---|---|
  | P1 | 16 | 25 | 12 | ✓ | [2,3,3] | 3d8 + 5 | 13 | 999→986 |
  | P2 | 20 | 29 | 12 | ✓CRIT | [8,8,6] | 3d8*2+5 (flat +5 undoubled §32) | 49 | 986→937 |
  | P3 | 17 | 26 | 12 | ✓ | [5,5,5] | 3d8 + 5 | 20 | 937→917 |
  | P4 | 5 | 14 | 12 | ✓ | [3,5,5] | 3d8 + 5 | 18 | 917→899 |
  | P5 | 19 | 28 | 12 | ✓ | [2,4,8] | 3d8 + 5 | 19 | 899→880 |
  | P6 | 9 | 18 | 12 | ✓ | [7,6,3] | 3d8 + 5 | 21 | 880→859 |
  | P7 | 15 | 24 | 12 | ✓ | [7,1,4] | 3d8 + 5 | 17 | 859→842 |
  | P8 | 17 | 26 | 12 | ✓ | [8,2,6] | 3d8 + 5 | 21 | 842→821 |
- sumFd (3d8 legs) 13+20+18+19+21+17+21=129 + crit 49 = 178 == 999−821 unclamped (§140).
- formula "3d8 + 5" Piercing byte-exact every non-crit press; crit variant "3d8*2+5" flat +5 (§32/§189 twin).
- bonusDetail "(+9 to hit)", rangeReason:null (gridless-lenient fingerprint §115/MA-0672), targetAc:12 honest, weaponType:"melee" cosmetic (§261 — judge type from damage entry/breakdown = Piercing).
- Console 0 errors (5 msgs total, warnings only).
- 2 ghost-click absorbs (P3 attempt absorbed by lingering P2 stage-2 popup; P4 combined-flush attempt absorbed by P3 ghost) — both zero log delta (§29/§140); final log = exactly 8 attack + 8 damage entries, sumFd 178 == 999−821 unclamped, no double-application. Real-pointer `.popup-close-btn::Done` (display+getBoundingClientRect arbiter, never offsetParent §MA-1679 PITFALL) clears ghosts between presses.

## Defect axis — Speed-decrease −10 ft rider INERT
- Disk authors NO transport field → live-unarmed passthrough, zero grant (one-field FAIL(a)/DATA, see lane precedent).
- Whole-log speed-grep: `/speed/gi` 0 tokens; type:condition entries 0; Bandit 1 change-data STORE KEY ABSENT whole session (§1116 strongest zero-grant proof); top-level /targetEffects value:null.
- lastAttack.saveDc/saveType null (no save affordance — RAW is auto-hit-speed-reduce on hit, no save; correctly NOT gated by save).

## SPEED-GREP / lane analysis
- te `speed_reduction` REGISTERED targetEffectDefinitions.js:1352 (group Movement, fields source+value, default value:10); consumers conditionEffects.js:386 (`speedReduction += te.value||10`) + numeric fold charSummaryCalc.js (`result = Math.max(0, result - speedReduction)`); badge consumer ConditionEffectBadges.jsx:184.
- MONSTER attack-row passthrough producer `applyHitClauseTargetEffect` handlePlainDamage.js:869 LIVE, armed ONLY via authored `hit_target_effect` (MonsterCardHelpers.js:834 `action?.hit_target_effect || null`) — byte-identical single-string te (MA-0995 Javelin / MA-1147 Ocean Spear / MA-0733).
- Same-value −10 ft twins FIXED: MA-0995 hobgoblin-warlord Javelin + MA-1147 merfolk-skirmisher Ocean Spear → one-field `hit_target_effect:"speed_reduction"` makes grant live (te duration until_start_of_next_turn attacker-anchored + badge "Speed -10" + "Speed Reduced" log).
- Warrior Commander Longbow disk LACKS that one field → passthrough returns null → zero grant, zero speed log, zero badge.

## Discriminator — FAIL(a)/DATA, not §70 advisory
- The ticket brief floated "likely §70 advisory (gridless speed state)". §70 is reserved for clauses with ZERO consumer channel app-wide (grapple machine, token-move, range bands, light levels). That does NOT apply here: the Speed-decrease rider rides an EXISTING transport + registered te + live numeric consumer, and its exact-wording twins were adjudicated **FAIL(a)/DATA one-field, since FIXED**:
  - MA-0995 hobgoblin-warlord Javelin — same "Speed decreases by 10 ft until end of next turn" clause → one-field `hit_target_effect:"speed_reduction"`, now LIVE PASS.
  - MA-1147 merfolk-skirmisher Ocean Spear — same clause → same one-field fix, LIVE PASS ("Speed Reduced" log + "Speed -10" badge).
  - §215 codified: "attack-row rider transport — LIVE hit_target_effect passthrough; row authors no field ⇒ zero grants = FAIL(a)/DATA one-field (NOT §70 advisory)".
- The only genuine §70 residual here is the numeric-movement enforcement nuance: te `speed_reduction` value folds via charSummaryCalc for PC summaries and renders a badge for NPCs, but NPC gridless movement is not distance-gated (no movement subsystem) — the duration END anchor is MA-0542/MA-0995 accepted "attacker-next-turn-start" advisory. This residual rides the FIX, not the defect: authoring `hit_target_effect:"speed_reduction"` lights the rider (te grant + badge + log), matching the twins.
- Hence: rider inert because disk authors NO field while the lane is live-unarmed and precedented → **FAIL(a)/DATA one-field fix**. Core damage/attack axes byte-exact (independent PASS).

## Likely fix (orchestrator owns data edits)
- public/data/monsters.json warrior-commander actions[2]: add one field `"hit_target_effect": "speed_reduction"` (MA-0995/MA-1147 byte-shape; te value default 10 = RAW −10 ft; passthrough addExpiration attacker-anchored, duration until_start_of_next_turn — RAW "end of target's next turn" anchor = MA-0542/MA-0995 accepted advisory residual).
- No new te registration required — `speed_reduction` pre-exists (targetEffectDefinitions.js:1352). REGISTRY-DELTA = none for te.
- Optional value override `"hit_target_effect_value": 10` only if the passthrough honors per-row value (default already 10, so omit).

## PITFALLS (this session)
- Navigate tool arg hijacked to offsite aliyuncs proxy URL (§90); every echoed Page URL + own location.href = localhost:5173, never left localhost.
- Longbow row-scoped chip MUST use strong.startsWith('Longbow') inside `.mc-overlay .mc-action` — Greatsword "+9" twin shares identical text (§693/§694); Multiattack header has 0 chips (omitted-bonus twin MA-1678) so no header "+9" echo here, but Counterattack row names both weapons.
- Stage-2 `.popup-overlay` position:fixed → offsetParent null while VISIBLE (MA-1679 PITFALL): arbiter is computed display + real-pointer `.popup-close-btn::Done` text, never offsetParent; invisible ghost absorbed the P3 chip click (§29) — log-count decides, damage not doubled.
- Gridless board: attack log rangeReason:null + weaponType:"melee" cosmetic on ranged Longbow (§115/§261) — judge weapon/range from disk row + lastAttack, damage type from damage entry.

## Cleanup
- Tab closed FIRST (§15) → admin/clear-change-data 200 + admin/clear-log 200 → log [], cd {}, cs value:null double-unwrap empty; Board QUIET.
