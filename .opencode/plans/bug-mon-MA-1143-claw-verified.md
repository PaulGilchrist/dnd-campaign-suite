# MA-1143 — Medusa Claw — VERIFIED: PASS (2026-09-24)

Row: medusa|actions|1, attack+save, +6, "2d6 + 3" Slashing, reach 5 ft.

## Static disk
- public/data/monsters.json medusa actions[1]: attack_bonus:6, damage_dice_primary:"2d6 + 3", damage_type_primary:"Slashing", reach:"5 ft.", save_dc:0/save_type:"" decoy (ungated §1071), NO damage_dice_secondary → §185 single-primary. Byte-exact vs manifest.

## Live setup (strict E2E, no direct POSTs)
- test-campaign header verified. Medusa/Bandit absent (post-MA-1142 admin clear) → joined via initiative "+NPC" + autocomplete (exact li). cs GET: Medusa AC15 hp127, Bandit AC12 hp11 (disk-exact; unsuffixed names §449; tracker inputs stale 10/10 — cs authoritative).
- Rig: Bandit current HP input → 999+Enter (cur 999, max authored 11 §450). Target armed AFTER rig via Medusa card target `<select>` native setter (§447 order); cs medusa.targetName="Bandit" confirmed.
- Chip audit: Claw row = exactly ONE span.mc-dice-link "+6"; .mc-dice-link-save = 0 in row AND overlay-wide.

## Presses (round 1, Bandit AC12)
1. nat 1 → popup "MISS (7 vs AC 12)" CRITICAL MISS; log +1 (rolls[1,..], total:1 bonus:6 hit:false); zero damage; hp 999→999.
2. nat 1 → MISS 7 vs AC 12; log +1; hp 999.
3. mouse press silent (log-delta 0 §442) → el.click re-fire: nat 7 → popup "HIT (13 vs AC 12)" + Done; button.dice-roll-reroll-btn clicked; log-delta 3: attack total 7+6=13 targetAc 12 hit, damage formula "2d6 + 3" rolls[1,6] total 10 finalDamage:10 Slashing SINGLE entry, hp_change delta -10 → 989. |hpΔ|=10==finalDamage ✓.
4. nat 15 → popup "HIT (21 vs AC 12)"; Done; log-delta 3: damage "2d6 + 3" rolls[3,6] finalDamage:12, hp_change delta -12 → 977. |hpΔ|=12==finalDamage ✓.

Ledger: 999→989→977 (−21 total, all Slashing, no secondary damage keys). 2 hits / 2 honest nat1 misses / 1 silent-fire logged honestly. No nat20 (faces 1,1,7,15) → §32 crit-doubling record N/A (MA-1117 twin available).

## Cleanup
Admin panel Clear Change Data + Clear Campaign Log (confirm dialogs accepted); post-state: log 0, cs creatures [], change-data {} ✓.

## VERDICT: PASS
