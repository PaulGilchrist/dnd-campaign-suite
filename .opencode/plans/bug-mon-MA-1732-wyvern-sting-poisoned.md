# MA-1732 — Wyvern Sting: Poisoned-condition rider inert (FAIL(a)/DATA)

## Overview
Wyvern Sting's damage core is exact live (primary+secondary+crit+miss), but the described "the target has the Poisoned condition until the start of the wyvern's next turn" rider never lands: disk `wyvern.actions[2]` carries no structured `hit_conditions` key and the consumer arms structured keys only — same lane as MA-1723 Winter Wolf Bite / MA-1726 Wolf Bite.

## Expected Behavior (row + monsters.json)
- Disk `wyvern.actions[2]`: attack_bonus 7, reach "10 ft.", primary "2d6 + 4" Piercing, secondary "7d6" Poison.
- Description/rider: "…and the target has the Poisoned condition until the start of the wyvern's next turn."
- On each hit: `poisoned` lands in victim `activeConditions` (+ `condition applied` log), expiring at start of wyvern's next turn (existing attacker-anchored `expireOnCreatureName` pattern, handlePlainDamage.js:926-934/:554, §5 clock).

## Actual Behavior (live, MA-1732 run 2026-09-30, 10 rolls)
- 9 hits: combined_damage_roll primary "2d6 + 4" Piercing + secondary "7d6" Poison, |hpΔ| == primary+secondary on every hit (31/43/36/36/60/25/33/36/38); nat20 crit doubled dice pools (1*2,2*2+4 + 25x2=50 → 60); nat1 miss zero damage.
- Poisoned probe after EVERY hit and miss: Bandit 1 change-data `activeConditions=None`, `activeConditionMeta=None`, `targetEffects=None`; condition-log entries 0/10. **Rider never lands.**

## Static proof chain
- Consumer `buildHitConditionClause` (MonsterCardHelpers.js ~:875→:900) arms ONLY structured `hit_conditions` — free-text rider never parsed (same chain cited MA-1723: MonsterCardModal.jsx:975/1992 → useLoggedDiceRollAttack.js:208 → handlePlainDamage.js:554-555).
- Disk holders abundant: `hit_conditions:["poisoned"]` on Assassin/Couatl/Ettercap/Dire Worg etc. (Ettercap byte-twin template), duration via existing anchored expiry.
- `wyvern.actions[2]` keys: name/description/attack_bonus/reach/damage_dice_primary/damage_type_primary/damage_dice_secondary/damage_type_secondary — no rider field.

## Steps to Reproduce
1. test-campaign → EB join "Wyvern" + Bandit (GM-fill HP).
2. Arm Bandit on Wyvern's initiative-row target select; open card → Sting "+7"; roll to a hit.
3. Full primary+secondary damage applies, but no Poisoned condition (change-data activeConditions absent, no condition log).

## Likely Location
`public/data/monsters.json` DATA drift — one-field fix: `"hit_conditions": ["poisoned"]` on `wyvern.actions[2]` (Ettercap template; expiry rides existing attacker-anchored pattern). Resolution consumer live.

## Notes
- Chip live, DC-none row, no recharge authored — FAIL(a)/scoped-to-rider, not FAIL(b).
- Board cleared via Admin after run; data fix requires its own fix pass + live re-verification (chip rider probe).
- Dire Worg's Bite MA-1727 used a different rider lane (advantage via hit_target_effect `distracting_strike_advantage`) — poisoned rider is the hit_conditions lane; do not conflate.
