# Bug MA-1162 — Mind Flayer Tentacles: inert Grappled+Stunned rider (FAIL(a)/DATA)

Date: 2026-09-25 · Row: MA-1162 mind-flayer|actions|0 "Tentacles"

## Symptom (live E2E, test-campaign)
4 fresh Tentacles fires (3 hits: nat5/12/13 vs AC12 Bandit 1, 1 honest miss nat4). Base damage exact ("4d8 + 4" Psychic, ONE entry/hit, fd==|hpΔ|, 999→922). But rider NEVER lands:
- Bandit 1 change-data: no `activeConditions`/`activeConditionMeta` keys at all.
- Campaign log: zero /grappl|stunned/ entries (viewingMonster excluded).
- DOM: zero condition badges (prose echo only).

## Root cause (static disk)
`public/data/monsters.json` mind-flayer actions[0] lacks the hit-clause transport keys:
- `hit_conditions` ABSENT · `escape_dc` ABSENT.
`buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:648-653) returns null when hit_conditions is absent → `applyHitClauseConditions` (src/hooks/combat/handlers/handlePlainDamage.js:543) never runs. Row prose explicitly authors "Grappled condition (escape DC 14)" and "Stunned condition until the grapple ends" — data omission, not transport gap.

## Twin family
MA-1157 (claws grapple+restrain), MA-1161 (Mimic Pseudopod grappled) — identical fingerprint. escape_dc HAS a live consumer (Helpers:656 → meta dc/ability STR + badge escape save), so its omission is a counted §461 gap.

## Fix
Add to mind-flayer actions[0]:
```json
"hit_conditions": ["grappled", "stunned"],
"escape_dc": 14
```
Stunned's "until the grapple ends" duration is GM-adjudicated prose (no transport vocabulary needed; badge re-save releases grapple). Do NOT invent duration fields.
