# BUG MA-1400 — Roper Tentacle: hit-granted Grappled (escape DC 14) + Poisoned never applied (FAIL(b)/DATA)

- **stableKey:** `roper|actions|2`
- **Monster/Row:** Roper actions[2] "Tentacle" — `attack_bonus:7`, `reach:"60 ft."`, NO damage dice (correct — zero damage on hit is authored behavior), `save_dc:0`/`save_type:""` decoy (§117/§1071)
- **Verdict:** FAIL(b)/DATA — ungated discrete-condition HIT rider unauthored (§MA-1344/§MA-1351/§MA-1357 family; direct same-index twin MA-1274 otyugh Tentacle)
- **Date:** 2026-09-27 · test-campaign · localhost:5173

## Disk row (verbatim rider fields)
```json
{
 "name": "Tentacle",
 "attack_bonus": 7,
 "save_dc": 0,
 "save_type": "",
 "save_effect": "",
 "range": "",
 "reach": "60 ft.",
 "recharge": ""
}
```
grep whole roper block (`hit_conditions|escape_dc|hit_target_effect|hit_condition_roll|target_prerequisite|conditional_damage`) = **GREP-ZERO**.
Description promises: "Hit: The target has the Grappled condition (escape DC 14) ... and the target has the Poisoned condition until the grapple ends."

## Twin census (all authored, consumers live)
| monster | row | hit_conditions | escape_dc |
|---|---|---|---|
| aberrant-cultist | Tentacle Lash actions[1] | [grappled, restrained] | **14** (exact co-key) |
| chain-devil | Chain actions[1] | [grappled, restrained] | 14 |
| crocodile | Bite actions[0] | [grappled, restrained] | 12 |
| giant-octopus | Tentacles actions[0] | [grappled, restrained] | 13 |
| mezzoloth | Claws actions[1] | [grappled, restrained] | 14 (save_dc:0 twin) |
| lizardfolk-shaman | Bite actions[1] | [grappled, restrained] | 12 (MA-1111) |
| otyugh | Tentacle actions[2] | [grappled] | 13 (MA-1274 byte-shape) |

Consumer chain LIVE and multi-condition capable:
- `buildHitConditionClause` (MonsterCardHelpers.js:673) reads `action.hit_conditions` ONLY (+`escape_dc`); row lacks both → returns null.
- `maybeApplyHitClause`/`applyHitClauseConditions` (handlePlainDamage.js:543/614) loops the full conditions array → `["grappled","poisoned"]` is expressible zero-code; meta stamps `{dc:escapeDc, ability:'str', source:attacker}`; size gate `isLargeOrSmallerTarget` admits Medium Bandit.

## Live ledger (test-campaign, Bandit 1 AC12 maxHp/currentHp 999, Roper targetName armed same full cs POST §491)
Tentacle "+7" chip anchored `strong.startsWith('Tentacle')` (Multiattack header spurious "+7" §440 + Bite "+7" share; Reel "+0" junk §490 never pressed):

| press | nat | total | AC | verdict | damage | rider grants |
|---|---|---|---|---|---|---|
| 1 | 4 | 11 | 12 | ✗ MISS | none | none |
| 2 | 8 | 15 | 12 | ✓ HIT | **zero entry** | **zero** |
| 3 | 17 | 24 | 12 | ✓ HIT | zero | zero |
| 4 | 15 | 22 | 12 | ✓ HIT | zero | zero |
| 5 | 2 | 9 | 12 | ✗ MISS | none | none |
| 6 | 5 | 12 | 12 | ✓ HIT (tie→attacker, boundary §199) | zero | zero |

- To-hit: every nat+7 exact; boundary pair straddles AC12 honestly (nat4→11✗ / nat5→12✓).
- Zero-damage axis: **CORRECT** — row authors no dice; 0 damage entries, 0 hp_change on 4/4 hits (§MA-1398 pre-confirmed ×2).
- Rider axis: **INERT** — 4/4 hits zero grants: whole-log `condition`/`applied` entries = 0; victim `Bandit 1` change-data store `{value:null}` = activeConditions/activeConditionMeta **KEY ABSENT** (strictest zero-grant proof §1116); top-level `targetEffects` null; `grappled` probe null; escape_dc 14 surfaced nowhere.
- Save axis: zero save rollType whole-log; save_dc:0 decoy rendered ZERO DC chip (chip census: Tentacle row = single "+7" `mc-dice-link`); console **0 errors**.
- Press hygiene: 8 chip presses → 6 attack log entries; 2 absorbed by ghost popup (§442), flushed by own Done between presses; log-delta is sole ledger.

## Tentacle-object clause (AC 20 / HP 10 / immunity Poison+Psychic / regrows)
Sub-object HP mechanics: no object-HP subsystem app-wide (§70) — GM-advisory by construction, documented honestly, not the defect axis.

## Fix (DATA, two-field, MA-1274 byte-shape; zero code)
```json
"hit_conditions": ["grappled", "poisoned"],
"escape_dc": 14
```
- escape_dc 14 = description-carried DC (8+PB+STR per RAW), byte-consistent with aberrant-cultist/chain-devil/mezzoloth DC14 authored twins.
- Poisoned rides same clause grant ("until the grapple ends" duration latch = §59/§68 badge-residual, family-accepted).
- Note: `applyHitClauseConditions` condition-applied log note hardcodes "held by a tentacle" (§571 cosmetic) — honest copy for Roper.

## Evidence pointers
- Ledger: log attacks nat [4,8,17,15,2,5] vs AC12, hits [8,17,15,5]; nDamage 0; conds []; saves []; victim store null; te null; console 0.
- Registry: Roper verifiedRow2 (MA-1399 Bite PASS today) — rig re-used per §MA-1399.
