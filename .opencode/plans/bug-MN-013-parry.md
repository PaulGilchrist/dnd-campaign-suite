# bug-MN-013-parry — Battle Master "Parry" reaction: no reaction economy + heal-restore persistence race

FAIL 2026-10-07 (re-test of 2026-09-01 PASS-subset; host EvasiveFighter lv18 Battle Master, test-campaign, EB Wight 1).

## Canonical (public/data/2024/maneuvers.json:123-131)
"When another creature damages you with a melee attack roll, you can use your Reaction and expend one Superiority Die to reduce the damage by the number rolled on the die + your Strength or Dexterity modifier (your choice)." — actionType `reaction`, trigger `melee_damage_taken`, effect `damage_reduction`, modifierAbility ["STR","DEX"].

## Defect 1 — Reaction never consumed (PRIMARY)
- No `_Parry_usedRound` / reaction-economy latch exists app-wide (grep `_Parry_usedRound|reaction_usedRound` = zero producers; executeReactionManeuver, executeActionManeuvers.js:547, spends die + heals but stamps NO reaction key — contrast Riposte RIPOSTE_USED_ROUND_KEY :504, Commanding Presence latch :604).
- Live: within one Wight turn, parry paid on EVERY damage instance (R17 free #1 then paid d12 "Rolled d12 for 2. Damage reduced by 4 (2 + 2 ...). HP restored: 79 → 83", pool 6→5 persisted); same-round second press → no refusal popup, second spend accepted. RAW: 1 reaction/turn → second pay must be refused.
- No auto-prompt on melee-hit face either: hit popup is only "✓ HIT (18 vs AC 18) | Done" — payment is manual press-after-commit of the sheet "Parry:" row (trigger `melee_damage_taken` has zero prompt producer; §CLA-199 gridless-affordance family).

## Defect 2 — HP restore persistence race (numeric exactness broken)
- `applyManeuverDamageReduction` (executeActionManeuvers.js:526-545) popup math is exact, but the `currentHitPoints` write is intermittently reverted by a stale combat/HP flush:
  - FAIL face: popup "Damage reduced by 5 (3 + 2 ...). HP restored: 89 → 94" and "HP restored: 81 → 84" → disk/server GET `currentHitPoints` stayed 89 and 81 respectively (well past 10s debounce; sheet re-render shows 81).
  - PASS face (same lane): 74→81, 79→83 persisted; earlier 103→108, 101→111 persisted.
  - `ability_use` log wrote fine in both cases ("Used Parry as a reaction. Rolled d8 ...") — only the HP key is lost. Race between parry's sequential `setRuntimeValue('currentHitPoints')` and the attacker-side lastAttack/hp flush.

## Working legs (keep passing faces)
- Arm: picker tick Parry + Confirm → runtime `BattleMasterManeuvers_selection:["Parry"]` → Reactions row "Parry:" live (maneuvers.js:49 reaction filter).
- Die: lv18 d12; paid math exact "d12 for 2 ... 4 (2 + 2)".
- Exhaustion refusal verbatim: "Parry: No Superiority Dice remaining. Recharges on a Short or Long Rest." (combatSuperiorityUtils.js:151); pool drain 5→0 exact; Short Rest restores 0→6.
- Control: HexWarlock (non-BM) sheet has NO "Parry:" row; same Wight attack took full damage 103→94, zero parry ability_use (all 13 parry log entries characterName=EvasiveFighter).

## Known accepted gaps carried (re-confirm)
- No STR/DEX "your choice" picker — auto `Math.max(strMod, dexMod)` (executeActionManeuvers.js:531); live host STR +2 vs DEX +0 auto-picked +2.

## Fix pointers
1. Add reaction-economy latch (CLA-383 / MN-004 `_Commanding_Presence_usedRound` shape) stamped at parry pay, re-armed via PLAYER_ROUND_LATCH_KEYS round-wrap; refuse press when latched or when no qualifying un-parried `lastAttack{target:holder,hit:true,damageApplied:true}` is pending; log refusal (§MN-003 §5 refusals log).
2. Make heal write win the flush: read-modify-write against server-fresh HP, or route reduction as a stamped `pendingParryHeal` consumed in attackPostProcessing after the lastAttack flush (consumeParryAcBonus lineage, attackPostProcessing.js:211).

## Post-run state
Admin cleared change-data + log, GET-verified `[]`/`0`; Wight removed with cs reset; character JSON untouched (Battle Master lv18 kept); picker selection wiped by clear.
