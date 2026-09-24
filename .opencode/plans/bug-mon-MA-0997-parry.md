# MA-0997 — Hobgoblin Warlord "Parry" — VERIFIED: FAIL(b)-DATA

Date: 2026-09-23 · Campaign: test-campaign (header byte-verified) · Rig: :5173 REUSE (curl 200) · No manifest edit, no git writes.

## Expected (row, disk public/data/monsters.json hobgoblin-warlord reactions[0])
`{name:"Parry", trigger:"The hobgoblin is hit by a melee attack roll while holding a weapon", description:"The hobgoblin adds 3 to its AC against that attack, possibly causing it to miss."}` — disk re-confirmed this session: **NO `automation` field**, no acBonus, no uses/maxUses.

## Actual (live)
Parry is inert prose. Zero affordance, zero click response, zero machinery reachable.

- Fresh card open (initiative round 8, HW 1 AC20 112/112). Reactions section row DOM verbatim:
  `<div class="mc-action "><strong>Parry.</strong> <span>The hobgoblin adds 3 to its AC against that attack, possibly causing it to miss.</span></div>`
  — **0 `.mc-dice-link`, 0 button/chip, 0 Expend affordance** (row affordance scan returned []).
- Parry row click: **no popup, no roll, no log** (log ring 500→500; no parry_* entry).
- Trigger seam IS live: Bandit 1 initiative card target-select armed "Hobgoblin Warlord 1", pressed Scimitar "+3" chip (1 press) → popup "Scimitar | d20 1 +3 | ✗ MISS (4 vs AC 20)". lastAttack stamped: attackerName "Bandit 1", targetName "Hobgoblin Warlord 1", weaponType "melee", targetAc 20, **effectiveAc 20 (no +3)**, hit:false. Warlord `activeBuffs`: absent; **no `_parry*` runtime keys**. No parry prompt, no refusal popup.
- Trigger-unreachability is NOT the issue: a melee attack on the warlord fired end-to-end; parry simply never armed or prompted.

## Grep evidence (machinery requires the automation field)
- Gate: `getGatedMonsterReaction` — `const effect = action?.automation?.effect; return effect ? GATED_MONSTER_REACTIONS[effect] || null : null;` — **MonsterCardHelpers.js:1530-1532**. No automation ⇒ null.
- Modal click route: `handleGatedReaction` — `if (!getGatedMonsterReaction(action)) return;` — **MonsterCardModal.jsx:2089-2090**. Null ⇒ silent return, zero popup/log/roll.
- Registry: `parry: { effect: 'parry', trigger: 'melee_hit', label: 'Parry', icon: 'fa-shield-halved' }` — MonsterCardHelpers.js:956; dispatch `if (def.effect === 'parry') return resolveMonsterParry(...)` — **:1609-1611**; `resolveMonsterParry` **:1258**; `buildParryBuff` **:1235** with **`:1236 const acBonus = Number(action?.automation?.acBonus) || 2;`** — acBonus is read ONLY from `automation.acBonus` (defaults 2, so 3 is unrepresentable without the field).
- AC consumption side: `getParryAcBonus` reads activeBuffs for `effect === 'parry'` — loggedDiceRollUtils.js:78; armed into hit math `ctx._parryAcBonus = getParryAcBonus(acTargetName, ...)` — useLoggedDiceRollAttack.js:485; folded into effective AC — hitResolution.js:284; cleanup — attackPostProcessing.js:199-200. Buffs on the warlord can ONLY be created by resolveMonsterParry, gated behind automation ⇒ producer dead.
- Gate uses `reactionMaxUses(action)` (maxUses/uses else 1) — MonsterCardHelpers.js:1553-1557, checked at :1571-1574 (§109: refusal prose "1/Day" cosmetic; math via reactionMaxUses).
- Byte-shape comparison, bandit-captain (MA-0341 authored template, disk): `automation: {type:"reaction", trigger:"melee_hit", effect:"parry", acBonus:2}` plus `usage:"At Will", uses:999, maxUses:999`. Warlord row carries none of these keys.

## Steps to reproduce
1. :5173 test-campaign → Initiative (round 8); open Hobgoblin Warlord 1 card (click `.npc-avatar` on its initiative card).
2. Reactions section: "Parry." row is prose-only (`mc-action` div, zero chips). Click row → nothing (log delta 0).
3. Arm Hobgoblin Warlord 1 on Bandit 1's initiative-card target-select; open Bandit 1 card; press Scimitar "+3" → resolves vs AC 20 with NO parry prompt/buff/refusal; lastAttack.effectiveAc stays 20.

## Likely location & fix (MA-0341 template)
`public/data/monsters.json` hobgoblin-warlord reactions[0] — add automation per §114:
```json
"automation": { "type": "reaction", "trigger": "melee_hit", "effect": "parry", "acBonus": 3 },
"usage": "At Will", "uses": 999, "maxUses": 999
```
acBonus MUST be authored 3 (row prose "adds 3"); omitting it silently yields 2 (:1236). reactionMaxUses per gate: At Will ⇒ 999/999 matching bandit-captain precedent.

## Notes
- Card UI showed subtype line "Medium Fey (Goblinoid)" for this campaign instance — cosmetic campaign-template artifact, out of scope, noted only.
- Console errors: **0** (whole session). Cleanup: modal closed, no clears, rig intact; Scimitar miss left honest zero side-effects.
- docs/monster-actions-manifest.json untouched. No git writes.
