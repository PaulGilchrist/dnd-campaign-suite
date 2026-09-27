# BUG MA-1389 — Remorhaz Bite: grapple+restrained HIT rider inert (unauthored hit_conditions/escape_dc)

**Verdict:** FAIL(b)/DATA — §MA-1357 Purple Worm Bite EXACT twin (ungated grapple+restrained attack-hit rider, disk row lacks the structured pair; consumer live-unarmed).

## Disk (public/data/monsters.json, Remorhaz actions[0], verbatim)
```
name: "Bite"; attack_bonus: 11; save_dc: 0; save_type: ""; save_effect: "";
reach: "10 ft."; range: ""; recharge: "";
damage_dice_primary: "2d10 + 7" (Piercing); damage_dice_secondary: "4d6" (Fire)
description: "Melee Attack Roll: +11, reach 10 ft. Hit: 18 (2d10 + 7) Piercing damage plus 14 (4d6) Fire damage. If the target is a Large or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 17), and it has the <strong>Restrained</strong> condition until the grapple ends."
```
- **hit_conditions: ABSENT / escape_dc: ABSENT** (whole Remorhaz block grep: 0 occurrences; Young Remorhaz also 0).
- attack_bonus 11 = PB(+4)+STR(+7) ✓; core fields byte-match description ✓; save_dc:0/save_type:""/save_effect:"" = §117 decoy (MA-1071 gate: zero DC chip rendered live, pendingSavePrompts null all session).

## Consumer live-unarmed
`buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:673-686) reads `action.hit_conditions` (+escape_dc) only; returns null when absent → hitClause null at MonsterCardModal.jsx:874 → handlePlainDamage grants never run. Raw manifest `conditions:["grappled","restrained"]` has ZERO attack-path consumers (§449/§495; MA-0010 seam rule §59/§153).
Bandit size "Medium or Small" passes isLargeOrSmallerTarget (§516) — rider WOULD fire if authored.

## In-file fix twins (grapple+restrained+escape_dc census)
Aberrant Cultist Tentacle Lash ["grappled","restrained"]+escape_dc:14 (MA-1357 cited) · Chain Devil Chain (14) · Crocodile Bite (12) · Giant Octopus Tentacles (13) · Lizardfolk Shaman Bite (12, MA-1111) · Mezzoloth Claws (14) · Rug of Smothering Smother (13). 71 rows app-wide arm hit_conditions; Remorhaz 0. Purple Worm Bite = co-twin also unarmed (MA-1357 FAIL(b)/DATA).

## Live E2E (test-campaign, localhost:5173, 2026-09-27)
Board: Remorhaz 1 (mIdx remorhaz, AC17/HP195 Huge) + Bandit victim (AC12, HP rig 999 via full-store cs POST; arm via own-card target-select, cs armed:Bandit).
- **Core axis LIVE byte-exact:** 33 attack presses → 32 hits, 1 manufactured miss (AC-rig ac:19 nat7+11=18 ✗, zero damage entry §887). Every hit ONE `combined_damage_roll` entry: formula "2d10 + 7" Piercing + secondaryFormula "4d6" Fire (§140/§516). Σfd 571 + Σsfd 501 = Σ|hpΔ| 1072 EXACT.
- **CRIT (nat20):** formula "2d10*2+7 (10, 1)" fd 29 (flat +7 undoubled §32/§467); secondary secondaryTotal 34 = 2×(3+4+6+4) = §533 silent doubling, formula text stays "4d6"; hpΔ −63 == fd+sfd; popup "CRITICAL MISS!" banner cosmetic on nat1 boundary hit (§695).
- **RIDER ZERO on ALL 32 hits incl. crit:** log condition/grapple/restrain entries = 0; victim change-data **key ABSENT** (Bandit never appears in change-data — §1116 strongest zero-grant proof); targetEffects null; zero escape_dc surfaced anywhere. Grappled+Restrained NEVER applied.
- **Zero save/DC (§117):** saves count 0 whole session; pendingSavePrompts null; zero "DC 0" chip rendered.

## Fix (two-field DATA, MA-1274 otyugh byte-shape, zero code)
Add to Remorhaz actions[0]: `hit_conditions: ["grappled","restrained"]` + `escape_dc: 17` (RAW DC from row's own description prose; 8+PB+STR would be 8+4+7=19 — disk prose 17 is canonical, disk-is-truth §3). Grants then land with meta {dc:17, ability:'str', source} + "(escape DC 17)" reason (MA-1111/MA-1274 live shapes). Sustained-grapple state-machine/expiry stays §70/§59 advisory residual.

## Ops notes (new)
- Stage-1 monster attack popup Advantage/Disadvantage badges are COSMETIC on this build (8 badge clicks held nat2 unchanged) — refines §900; crit fishing must be fresh chip presses.
- 38 chip presses, 0 absorbed (simple melee high-bonus chip no-absorb family §615/§646 twin).
- Client popup HP arithmetic desyncs late-fight ("HP: 29 → 0" while server ledger tracked ≥63 pre-crit) — §665-class advisory; hp_change log deltas are truth (§18).
