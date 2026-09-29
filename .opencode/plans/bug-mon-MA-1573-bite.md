# BUG MA-1573 — Tarrasque "Bite": hit-grapple→restrained rider (escape DC 20) and "can't bite another target" gate inert

**Verdict: FAIL(a)/DATA** — base attack exact LIVE; both prose riders inert (row ships name/desc/attack_bonus/reach/dice only, NO `hit_conditions`).
**Row:** Tarrasque / Bite / attack, +19, reach 10 ft., 4d12 + 10 Piercing, conditions [grappled, restrained] (prose only)
**Date:** 2026-09-29 · E2E via Playwright on localhost:5173, test-campaign ONLY

## Cannot-miss documentation (per row instruction)

+19 vs Bandit AC 12: minimum possible total is **20** (nat 1 + 19 > 12) → **miss is unreachable**; every d20 face hits. All three live attacks landed honestly: nat 7 → 26, nat 4 → 23, nat 13 → 32 (each "HIT vs AC 12").

## What failed

1. **FAIL — Hit → Grappled + Restrained rider (escape DC 20) inert.** Three resolved hits (Bandit 1 ×2, Bandit 2 ×1). After each, Bandit owners are **ABSENT entirely** from `character-change-data.json` (no `activeConditions`, no `activeConditionMeta`, no targetEffects). Whole-log scan of `campaign-log.json`: **zero** `grapple`/`restrain` strings. Only prose mentions of grapple live in `combat-ui-viewingMonster/actions[*]/description` (card text blob) — no condition ever applied.
2. **FAIL — "can't bite another target" gate: NO consumer (recorded honestly, ungated).** Two consecutive Bite presses with the target re-selected between them: Bite #2 at Bandit 1 (hp_change −21) and later Bite #3 at Bandit 2 after retarget (`combatSummary.targetName: "Bandit 2"` persisted) both fully resolved (damage applied both times). Nothing gates a second bite against a different target — and with the grapple itself inert (finding 1) there is no grapple state for any gate to key off. Static scan: no code consumes "can't bite another target"-style one-target grapple gates anywhere in `src/hooks/combat`/`src/services/combat`.

## PASS-partial evidence (what IS correct — inside the bug)

- **Base +19 exact:** card chip "+19" = attack_bonus 19. Popups: "d20 7 +19 (+19 to hit) → HIT (26 vs AC 12)", "HIT (23 vs AC 12)", "HIT (32 vs AC 12)".
- **Base 4d12 + 10 Piercing exact LIVE:** damage log entries `formula: "4d12 + 10"`, `damageType: "Piercing"`, rolls `[4,2,3,2]=21`, `[4,12,1,5]=32`, `[2,4,12,9]=37`; popups "32 damage applied to Bandit 1 — HP: 999 → 967", "37 damage applied to Bandit 2 — HP: 999 → 962". `finalDamage` matches dice+modifier with no resistance (Bandit none).
- **Structure:** EB exact-name add Tarrasque ×1 + Bandit ×2 → Join → initiative tracker with Tarrasque 1 (676/676, AC 25 shown) and Bandit 1/2 (11/11, AC 12).

## Component → guard map (why inert)

| # | Component | Manifest keys present | Structured key needed | Guard |
|---|-----------|----------------------|----------------------|-------|
| 1 | +19 4d12+10 Piercing, reach 10 ft. | attack_bonus, damage_dice_primary, damage_type_primary, reach | — | LIVE exact ✓ |
| 2 | Hit → Grappled (escape DC 20); target Restrained until grapple ends | prose only | `hit_conditions: ["grappled", "restrained"]`, `escape_dc: 20` | `applyHitClauseConditions` only runs from the `action.hit_conditions` ledger (`src/components/encounter/MonsterCardHelpers.js:795` `if (!Array.isArray(action?.hit_conditions)) return []`; consumer `src/hooks/combat/handlers/handlePlainDamage.js:553`, MA-1541/1569 lane) |
| 3 | "can't bite another target" while grapple lasts | prose only | new structured one-target-grapple gate, e.g. `requires_grappled_target_by: self` / `exclusive_grapple_attack: true` | **No consumer exists** anywhere in `src/hooks/combat/` — needs new consumer keyed off attacker's own grapple condition on its current target |

## Proposed data fix (row in `public/data/monsters.json`, Bite action)

```json
{
  "hit_conditions": ["grappled", "restrained"],
  "escape_dc": 20
}
```
Two-field fix in the existing MA-0812→MA-1569 `hit_conditions`/`escape_dc` lane (badged STR escape via activeConditionMeta). Finding 3 additionally requires a NEW consumer for the exclusive-bite gate (no existing lane); record as follow-up — do not gate on the badge alone until a grapple-subsystem exists.

## Notes

- **Source description typos (cosmetic data housekeeping):** "36 (**4dl2** + 10)" — letter L instead of d; "**Ifthe** target" — missing space. Structured dice is correct (`damage_dice_primary: "4d12 + 10"`), so resolution is unaffected. Fix prose in `public/data/monsters.json` Tarrasque Bite.description. (Frightful Presence/Swallow rows also carry "ofthe"/"ofanother" spacing typos — same housekeeping family, out of MA-1573 scope.)
- **GM max-HP quirk recurred (same family as MA-1547/1569):** synthetic native-setter+change+blur on the initiative `hp-inline-input` did NOT persist (uncontrolled `defaultValue` + blur-commit input, `src/components/initiative/CreatureHp.jsx:24`); first real-keyboard fill (click → select-all/clear → type 999 → Enter commits via keydown-blur) DOES persist (`combatSummary` currentHp 999/999, exceeding maxHp 11 — persisted as authored, no clamp). Bandit 1 was downed (−21 → 0/11, `isUnconscious: true`) by bite #1 before the HP raise landed.
- Phantom second value in attack log `rolls` ([7,8], [4,3], [13,3]; total from rolls[0]) — cosmetic logging noise, same as MA-1569; hit math self-consistent.
- Swallow ("makes one bite attack against a Large or smaller creature it is grappling") would also depend on the grapple existing — currently untestable while finding 1 stands.

## Cleanup performed

Admin → Clear Change Data + Clear Campaign Log (test-campaign), initiative cleared with it. Only test-campaign touched.
