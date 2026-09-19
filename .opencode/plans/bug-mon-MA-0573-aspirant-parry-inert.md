# MA-0573 — Death Knight Aspirant Parry (reaction) INERT — FAIL(b)

## Row
- id: MA-0573 | monster: Death Knight Aspirant (death-knight-aspirant) | category: reactions | actionIndex 0
- Trigger (prose): "The aspirant is hit by a melee attack roll while holding a weapon."
- Description: "The aspirant adds 4 to its AC against that attack, possibly causing it to miss."

## Verdict: FAIL(b) — prose-trigger inert reaction (direct twin of MA-0565 death-knight)

## Disk truth
- `public/data/monsters.json` death-knight-aspirant.reactions[0]: name/trigger/description ONLY — **no `automation` field**, no acBonus, no usage/uses.
- Chip gate is `action?.automation?.effect` ONLY (`MonsterCardHelpers.js:1063-1066 getGatedMonsterReaction`) → returns null for this row → `GatedReactionSlot` renders no affordance (`MonsterAction.jsx:134-137`).
- No fallback row-name parser: row has no attack_bonus/save_dc/dice → generic shells never render (§60).
- No 2024 twin (`grep death-knight-aspirant public/data/2024/` zero).

## Live proof (test-campaign, :5173, header-verified)
- EB join "Death Knight Aspirant" → cs "Death Knight Aspirant 1" idx 0, AC20, currentHp178, round 1. Baseline log count = 2.
- Card Reactions renders exactly 1 Parry row ("Parry. The aspirant adds 4 to its AC...") — **chips 0**: diceLinks 0 / buttons 0 / links 0 / role=button 0 in row, while same-card `span.mc-dice-link` total = 4 (Dread Blade / Hellfire Orb alive) = renderer healthy, row inert.
- Click probe on row (rect 603,828): log delta attributable to click **0** (2-entry delta = own join noise: `encounter join` + initiative `roll` at join timestamps 1789815812100/812102). Zero parry entries, no popup/modal, card stays open, change-data `Death Knight Aspirant 1` keys empty, no parry buff.

## Fix (DATA, mirrors Bandit Captain MA-0341 template)
In `public/data/monsters.json` death-knight-aspirant.reactions[0] add:
```json
"usage": "At Will", "uses": 999, "maxUses": 999,
"automation": { "type": "reaction", "trigger": "melee_hit", "effect": "parry", "acBonus": 4 }
```
Consumers already live (`useLoggedDiceRollAttack.js:442 _parryAcBonus` → `hitResolution.js:281-284 effectiveAc += _parryAcBonus`; producer `buildParryBuff`/`resolveMonsterParry` gated on `automation.effect:'parry'`; `parryGate` 1/round latch exists).

## Cleanup
- npc-remove confirm-override removed Aspirant (cs 0 aspirants); admin clear-change-data + clear-log → log 0 / change-data keys 0; hard-reload verified.
