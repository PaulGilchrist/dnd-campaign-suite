# BUG MA-1720 — Will-o'-Wisp Invisibility — FAIL(b)/DATA (zero affordance, prose-only disk block)

**Date:** 2026-09-30
**Row:** MA-1720 Will-o'-Wisp Invisibility (condition, category actions)
**Verdict:** FAIL(b)/DATA — no chip rendered; action inert. One-field data fix (template MA-1522).

## Description (expected)
"The will-o'-wisp and its light magically become invisible until it attacks or uses its Consume Life, or until its concentration ends (as if concentrating on a spell)."

## Disk shape (DISK WINS)
`public/data/monsters.json` Will-o'-Wisp → actions → Invisibility:
```json
{ "name": "Invisibility",
  "description": "The will-o'-wisp and its light magically become invisible until it attacks or uses its Consume Life, or until its concentration ends (as if concentrating on a spell)." }
```
Prose-only. NO `automation` key, NO `self_buff` key, no numeric fields.

## Byte-shape contrast (sprite/imp — MA-1522 / MA-1019 fixed twins)
Sprite + Imp Invisibility (identical shape, on disk):
```json
{ "name": "Invisibility",
  "description": "The sprite/imp casts <strong>Invisibility</strong> on itself, ...",
  "spellcasting_ability": "Charisma",
  "automation": { "type": "monster_self_buff", "effect": "invisible", "rounds": 600 } }
```
Sea Hag IllusoryAppearance (MA-1449): `automation:{type:"monster_self_buff",effect:"disguised",rounds:14400}`. Ghost Ethereality (MA-0780): `automation:{type:"monster_self_buff",effect:"ethereal",rounds:4800}`.

## Grep proof — renderer arms ONLY on structured key (§88)
- `src/services/encounters/monsterSelfBuff.js:25-27` — `isMonsterSelfBuffRow(row)` returns `row?.automation?.type === 'monster_self_buff' && !!row.automation.effect`. No prose fallback anywhere in the function.
- `src/components/encounter/MonsterAction.jsx:255-256` — `SelfBuffLink` short-circuits `if (!isMonsterSelfBuffRow(action) || legendaryGate) return null;` → chip never renders.
- `src/services/encounters/monsterSelfBuff.js:242` — resolver `resolveMonsterSelfBuffRow` refuses `reason:'not-self-buff'` when the automation key is absent.
- `grep "invisib" MonsterCardHelpers.js saveProcessing.js` → zero hits in those two files; `targetEffectDefinitions.js:850` pre-registers `effect:'invisible'` but only the structured arm reaches it.
- No `monsterSelfBuff.will-o-wisp-*.test.js` exists (sprite/imp/quasit/green-hag twins all have pin tests).

## Live probe (test-campaign, round 1, Will-o'-Wisp 1 init 2 + Bandit 1 init 1)
1. Header verified `test-campaign` after select.
2. INNER img click → `.mc-overlay` opened (card: AC 19, HP 22, Shock/Consume Life/Invisibility rows present).
3. Overlay `.mc-dice-link` inventory: `["-5","+9","+0","+1","+2","+0","+4"]` — ability modifiers + Shock attack chip ONLY.
4. Invisibility row DOM: `<div class="mc-action">` → `<strong>Invisibility.</strong>` + plain `<span>` prose. **NO** `mc-dice-link`, **NO** `role=button`, **NO** `mc-dice-link-selfbuff`. Zero clickable affordance → nothing to click, no popup, no te, no `ability_use` log possible.
5. te snapshot `Will-o'-Wisp 1` runtime keys BEFORE: `['lastAttackRoll','_lastRollContext','pendingCombatSuperiorityPrompt']` — no activeConditions/activeBuffs. AFTER (nothing fired): unchanged.
6. Attack-breaks-invisibility probe: N/A — te never lands, nothing to break (§60 inert prose).

## Precedents
Playbook §60 (prose-only attack rows = inert), §68, §88 (parsers arm only on structured keys), §MA-1449 (Sea Hag self-buff `disguised` FIXED), §MA-1522 (Sprite Invisibility FIXED — Imp MA-1019 byte-twin), MA-0780 (Ghost self-buff). Quasit + Green Hag invisible-passage carry the same structured key with pin tests.

## Fix template (one field, per MA-1522)
Add to the wisp Invisibility block in `public/data/monsters.json`:
```json
"automation": { "type": "monster_self_buff", "effect": "invisible", "rounds": 600 }
```
(Rounds: sprite/imp use 600 = 1 h concentration clock; wisp's RAW end-conditions "attacks / Consume Life / concentration ends" map to the same te:'invisible' definition at targetEffectDefinitions.js:850 which already logs "enders on attack". Attack-break leg needs the same GM-adjudicated handling the sprite/imp rows already ride.)
NOT applied — verification row, data edit out of scope; manifest untouched, no git writes.
