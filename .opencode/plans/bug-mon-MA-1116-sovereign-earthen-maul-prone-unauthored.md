# MA-1116 — Lizardfolk Sovereign "Earthen Maul": Prone-on-hit never applies (FAIL(a)/DATA, one-field `hit_conditions`)

## Overview

**Row:** MA-1116 · `lizardfolk-sovereign|actions|2` · "Earthen Maul" (Melee, +5, reach 5 ft., 2d6+3 Bludgeoning, **Prone on hit vs Medium or smaller**).

**Verdict:** FAIL(a)/DATA. The damage/to-hit core axis is exact across two honest hits, but the canonical **Prone** rider never lands on a Medium-or-smaller victim: the row authors no `hit_conditions`, so the live hit-clause transport (MA-0010 seam) collapses to `null` and the consumer early-returns. This is the §153 MA-0291/0361/0877/0909 family — distinct from the MA-1115 prose-only escape (§410), because **the transport for this rider EXISTS and is live-capable; it is simply unarmed**. §410's prose-only escape explicitly does not cover canonical condition words with a live-capable transport (MA-0687/MA-0984 conversions are the authority).

## Expected

Row, disk verbatim (`public/data/monsters.json` → `lizardfolk-sovereign.actions[2]`):

> "Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Bludgeoning damage. If the target is a Medium or smaller creature, it has the **Prone** condition."

Disk keys observed (byte re-verified this session):
`['name', 'description', 'attack_bonus', 'save_dc', 'save_type', 'save_effect', 'range', 'reach', 'recharge', 'damage_dice_primary', 'damage_type_primary']`
— **NO `hit_conditions`, NO `escape_dc`, NO `hit_target_effect`** (all three keys occur 0× across the whole sovereign object). `attack_bonus: 5`, `damage_dice_primary: "2d6 + 3"`, `damage_type_primary: "Bludgeoning"`, `reach: "5 ft."`.

RAW: a hit on a Medium-or-smaller creature grants the Prone condition.

Live consumer chain (proven by grep, file:line):

| Step | Location | Behavior |
|---|---|---|
| 1. Parser | `src/components/encounter/MonsterCardHelpers.js:648` `buildHitConditionClause` | :650 reads **`action.hit_conditions` only** (lowercased); :653 `conditions.length===0 && !targetEffect && !conditionRoll → return null` |
| 2. Forward | `src/components/encounter/MonsterCardModal.jsx:873` | attack options carry `hitClause: buildHitConditionClause(action)` → null for this row |
| 3. Consumer | `src/hooks/combat/handlers/handlePlainDamage.js:611` `maybeApplyHitClause` | :613 `if (!hitClause …) return;` — early-return with null clause; :614 size gate `isLargeOrSmallerTarget(target.size)` |
| 4. Grant | `handlePlainDamage.js:543` `applyHitClauseConditions` | writes victim `activeConditions` + `activeConditionMeta{source}` and logs `type:'condition'`+`condition` (§274 shape) — never reached this session |
| Size gate | `handlePlainDamage.js:518` `isLargeOrSmallerTarget` | "Medium or Small" → largest named = Medium ≤ Large → **gate passes** for the Bandit victim (MA-0553 range-shape handled) |

Authored byte-twin fix template (in-file): gas-spore-fungus "Tendril" (MA-0763) — same key set plus trailing `hit_conditions: ["poisoned"]`.

## Actual (live ledger, test-campaign, 2026-09-24, dev :5173 / Express :80)

Board staged fresh: EB exact-td joins "Lizardfolk Sovereign" + "Bandit" (checked-rows pre-Join enumerated = `["Bandit","Lizardfolk Sovereign"]`; Bandit Captain joined nowhere), Bandit 1 hp/stamina staged 999 via full-store `/combatSummary {combatSummary:cs}` all-four HP keys, reload + re-select (header==test-campaign), target armed Bandit 1 on Sovereign's OWN initiative-card `[data-testid="target-select"]` (Playwright selectOption). Victim Bandit 1: ac **12** (live re-read §372), size **"Medium or Small"**.

- Press 1: popup "✓ HIT (20 vs AC 12)"; log attack `name:"Earthen Maul" total:15 rolls:[15,5] bonus:5 targetAc:12 hit:true mode:"normal"`; log damage `name:"Earthen Maul" formula:"2d6 + 3" rolls:[1,5] total:9 finalDamage:9`; `hp_change Bandit 1 Δ−9 999→990 breakdown[{Bludgeoning,9,resisted:false,status:null}]`. Done was a REAL pointer click on `button.dice-roll-reroll-btn`; stage-2 `.popup-overlay` flushed by `el.click()` after log-confirm.
- Press 2: popup "✓ HIT (24 vs AC 12)"; attack `total:19 rolls:[19,5] bonus:5 targetAc:12`; damage `formula:"2d6 + 3" rolls:[5,2] finalDamage:10`; `hp_change Δ−10 990→980 resisted:false`. `lastAttack {total:24, bonus:5, targetAc:12, hit:true, damageFormula:"2d6 + 3", actualDamage:10, saveDc:null, saveType:null}`.
- One attack + one damage log entry per press, both `name:"Earthen Maul"` (§147). No nat20 rolled in the two hits → crit variant `2d6*2 + 3` **unobserved** (recorded).
- Console: **0 errors**.

**Rider probe after EACH hit** (GET `/api/campaigns/test-campaign/Bandit 1`, wrapper unwrapped §258; plus whole-log grep + refetch ≥1.2s §386):
- `activeConditions` → **KEY-ABSENT**
- `activeConditionMeta` → **KEY-ABSENT**
- `Bandit 1` change-data store → **absent entirely** (cd top keys were only `combatSummary, AasimarTest, activeCreatureName, combat-ui-viewingMonster(+CreatureName), Lizardfolk Sovereign 1, lastAttack`)
- top-level `targetEffects` → KEY-ABSENT
- whole-log scan for `prone` (any case, any field) → **0 entries**; zero `type:"condition"` grants of any kind.

Two hits, one Medium-or-smaller victim, zero Prone grants, zero condition log entries — producer never ran (the absence of even the victim store key proves `applyHitClauseConditions` was never reached, consistent with `maybeApplyHitClause` early-returning at :613 on the null clause).

## Steps to Reproduce

1. `npm run dev` (dev:locked), open http://localhost:5173, select **test-campaign** (verify header).
2. Encounters → search "Lizardfolk Sovereign" → check row (exact td-text + native `cb.click()`); re-search "Bandit" → check **only** the exact `td === 'Bandit'` row (NOT Bandit Captain §124); enumerate checked rows pre-Join (EB retains checkboxes §441); Join; poll `/combatSummary` until both joined.
3. Stage Bandit 1 `currentHp/maxHp/currentHitPoints/maxHitPoints = 999` via POST `/api/campaigns/test-campaign/combatSummary` body `{"combatSummary": cs}` (§441 — never `/change-data`); reload + re-select campaign.
4. Initiative → arm Bandit 1 on Sovereign's own card `[data-testid="target-select"]` via Playwright `selectOption`.
5. Open Sovereign card (avatar). Audit: rows render "+5" chips on Multiattack (BOGUS header chip §441 — do not press), Bite, Earthen Maul; **no DC chip renders** (§437 `Number(save_dc)<=0 → null`, MonsterAction.jsx:115).
6. Real-pointer click the "+5" chip **inside the `.mc-action` whose `<strong>` startsWith "Earthen Maul"**; real-pointer Done (`button.dice-roll-reroll-btn` §286); flush stage-2 `.popup-overlay` `el.click()` after log-confirm (§294). Repeat until 2 hits (nat ≥7 vs AC12).
7. After each hit: GET `/api/campaigns/test-campaign/Bandit 1` (unwrap) → `activeConditions`/`activeConditionMeta` absent; GET `/log` → 0 prone `type:"condition"` entries; damage/hp ledger exact.

## Likely Location & Fix

**`public/data/monsters.json` data drift — one-field fix.** Add to sovereign `actions[2]`:

```json
"hit_conditions": ["prone"]
```

placed as the trailing key, byte-twin of the MA-0763 gas-spore-fungus Tendril fix shape (`…, "damage_dice_primary", "damage_type_primary", "hit_conditions": [...]`). No code change needed — the producer/parser/consumer chain (Helpers:648 → Modal:873 → handlePlainDamage.js:611/:543) is live and proven working on authored twins (MA-0877 `poisoned`, MA-0801/MA-0909 grapple family, MA-0775/MA-0763 same-pass grants with source meta).

**Design caveat (Notes, not a blocker for this fix):** the row's RAW clause is "**Medium or smaller**", but the consumer size gate `isLargeOrSmallerTarget` (handlePlainDamage.js:518, §153/MA-0877) admits **Large** victims too. A naive `hit_conditions:["prone"]` would therefore over-apply Prone on Large targets (e.g. a Large creature hit by the Maul). No size-threshold transport exists today in the hit-clause schema (only `size_max`-less arrays); the Medium-victim grant on this Medium attacker is the dominant real-world case and matches the §153 codified standard — record the Large over-apply as a design caveat for the fix reviewer (same caveat already documented on MA-0877/MA-0909 family fixes).

## Notes

- **§274 log-entry shape:** a landed grant would appear as `type:"condition"` + `condition:"Prone"` + `characterName:<victim>` + `reason:"Earthen Maul (escape DC —)"` — the whole-log grep used this (plus case-insensitive substring across every entry) and found zero.
- **§386 log lag:** probes were re-fetched ≥1.2 s after Done both times; the KEY-ABSENT victim store is a producer-absence fingerprint, not lag (lag could hide a log line, never an entire store key once a grant ran).
- **DC0 decoy / manifest label noise:** manifest labels the row `"attack+save"` but disk carries `save_dc:0, save_type:"", save_effect:""` — no save half exists; renderer keys disk only (§117). §437 DC0 gate confirmed live: zero DC chips rendered, `lastAttack.saveDc:null` on both hits, damage never routed through a save lane (full-value `resisted:false` both hits, §416/§417 protocol honored — only the "+5" chip was ever pressed, and the Multiattack header chip §441 was excluded from all counts).
- **MA-1114 corroboration (same monster, same session-day):** Multiattack pass observed Maul component damage `2d6 + 3` exact but **Prone inert** (victim `activeConditions` null, zero condition logs) — this ticket re-produces the identical fingerprint on the standalone chip with fresh live proof, ruling out a multiattack-route-specific defect.
- **§232 incidental:** no prone→advantage interplay observable (prone never granted); both attack logs stamped `mode:"normal"` (rolls `[nat, bonus]` display pair §92). Popup "Advantage/Disadvantage" toggle text is standard chrome (§92).
- **Rig hygiene (§413):** victim AC was never stamped (disk AC12 throughout, live-verified); the only rig writes were Bandit 1 HP-999 on combatSummary, erased by the admin clears. Final board: cs `null`, log 0 entries, cd `{}`.
