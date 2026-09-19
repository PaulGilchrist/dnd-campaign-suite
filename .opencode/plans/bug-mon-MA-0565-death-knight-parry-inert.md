# MA-0565 — Death Knight Parry (reaction) INERT — FAIL(b)

## Row
- id: MA-0565 | monster: Death Knight (death-knight) | category: reactions | actionIndex 0
- Trigger (prose): "hit by melee attack while holding weapon"
- Description: "Adds 6 to AC vs that attack, possibly causing miss."

## Verdict: FAIL(b) — prose-trigger inert reaction (twin fingerprint MA-0516/0544/0548/0554)

## Disk truth
- `public/data/monsters.json` death-knight.reactions[0]: name/trigger/description ONLY — **no `automation` field**, no acBonus, no usage/uses.
- Chip gate is `action?.automation?.effect` ONLY (`MonsterCardHelpers.js:1063-1066 getGatedMonsterReaction`) → returns null for this row → `GatedReactionSlot` renders no affordance (`MonsterAction.jsx:134-137`).
- No fallback row-name parser: row has no attack_bonus/save_dc/dice → generic shells never render (§60, MonsterAction.jsx gate review).

## Producer/consumer grep
- Consumer chain LIVE: `useLoggedDiceRollAttack.js:442 ctx._parryAcBonus = getParryAcBonus(...)` → `hitResolution.js:281-284 effectiveAc += context._parryAcBonus`.
- Sole buff producer: `buildParryBuff` (effect:'parry', MonsterCardHelpers.js:899-902) reachable ONLY via `resolveMonsterParry` (:922) dispatched at :1142 — gated on `def.effect==='parry'`, which requires authored `automation.effect:'parry'`. Death Knight row never reaches it.
- Proven template: Bandit Captain (MA-0341) row authors `automation:{type:'reaction',trigger:'melee_hit',effect:'parry',acBonus:2}` + `usage:"At Will", uses:999`.

## Live proof (test-campaign, :5173, header-verified)
- EB join "Death Knight" → cs "Death Knight 1" (idx 0, round 1). Baseline log count = 2.
- Card Reactions section renders exactly 1 Parry row: "Parry. The death knight adds 6 to its AC..." — **chipCount 0** (zero `span.mc-dice-link`/button/link in row).
- Click probe on row (rect 603,941): log delta **0**, zero parry entries, no popup/modal, card stays open, change-data `Death Knight 1` keys empty, no parry buff.
- No 2024 twin file match for death-knight.

## Fix (DATA, mirrors MA-0341 template)
In `public/data/monsters.json` death-knight.reactions[0] add:
```json
"usage": "At Will", "uses": 999, "maxUses": 999,
"automation": { "type": "reaction", "trigger": "melee_hit", "effect": "parry", "acBonus": 6 }
```
Consumers already live; 1/round latch + lastAttack.parryResolved identity gate exist (`parryGate` :877). Death Knight Aspirant (+4, acBonus:4) is the same fingerprint — sibling ticket.
