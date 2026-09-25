# MA-1144 — Medusa Snake Hair — VERDICT: PASS (2026-09-24)

## Row
MA-1144, medusa actions[2], actionType attack+save, attackBonus 6, saveDc 0 (decoy), saveType "", primary "1d4 + 3" Piercing + secondary "4d6" Poison, reach 5 ft.

## Static disk
public/data/monsters.json medusa actions[2] byte-exact vs manifest: attack_bonus:6, save_dc:0, save_type:"", damage_dice_primary:"1d4 + 3", damage_type_primary:"Piercing", damage_dice_secondary:"4d6", damage_type_secondary:"Poison", reach:"5 ft.", range:"", recharge:"", description byte-exact.

## Live E2E (test-campaign, fresh session; campaign header verified)
No Medusa/Bandit in running initiative (14 PCs, round 1) → both joined via initiative "+NPC" autocomplete (§451): Medusa 127/127 AC15, Bandit 11/11 AC12 — both disk-exact (Monsters.json armor_class medusa:15, bandit:12/HP11).
HP rig BEFORE arm (§447): Bandit currentHp 999 via input[aria-label="Bandit current HP"] fill+Enter → cs 999/11 (§450 no clamp). Arm via attacker init-card depth-walk select (§451) → server-side creatures[Medusa].targetName="Bandit" (NEW: armed target lives on attacker creature entry, cs.targetName absent in this build).

## Chip audit
Snake Hair row: exactly ONE "+6" mc-dice-link chip (strong.startsWith §180 anchor), ZERO .mc-dice-link-save DC chips. Row text disk-exact (trailing "()" §445 artifact).

## Fires (4 fresh, round 1, log-delta ledger §442, popup poll .dice-roll-result §451)
1. HIT nat11+6=17 vs AC12 — popup "17 d20 11 +6 ✓ HIT (17 vs AC 12)"; ONE damage entry formula "1d4 + 3" Piercing finalDamage 7 + secondaryFormula "4d6" secondaryFinalDamage 11; hp_change delta -18; 999→981; 7+11=18=|hpΔ| EXACT.
2. HIT nat19+6=25 — fd5 + sfd21 = 26 = |Δ| 981→955 EXACT.
3. HIT nat17+6=23 — fd7 + sfd16 = 23 = |Δ| 955→932 EXACT.
4. HONEST MISS nat4+6=10 vs AC12 — ✗ MISS popup, DONE-less dismiss, HP 932 unchanged, log-delta +1 (roll/attack only, zero damage/hp_change entries) EXACT.

Popup total == nat+6 on every press; every hit exactly ONE combined_damage_roll damage entry carrying both byte-exact formulas. No nat20 → §32 crit N/A.

## Cosmetic artifacts (families only, no ticket)
- Attack-log rolls:[4,7]-style dupe/cosmetic second die, total=nat (§414/§451 family).
- Tracker inputs stale post +NPC-join; cs GET sole truth (§451).

## Cleanup
Admin panel: Clear Change Data + Clear Campaign Log (confirm dialogs auto-accepted §444) → verified change-data {}, log [], combatSummary value:null.

## Verdict
PASS — all axes strict-exact.
