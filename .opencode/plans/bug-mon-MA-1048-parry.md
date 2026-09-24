# MA-1048 — Knight "Parry" — VERDICT: FAIL(b)-DATA

Date: 2026-09-24 · Campaign: test-campaign (header verified) · :5173 REUSE (curl 200) · No manifest edit, no git writes.

## Expected (disk public/data/monsters.json knight reactions[0])
`{name:"Parry", trigger:"The knight is hit by a melee attack roll while holding a weapon", description:"The knight adds 2 to its AC against that attack, possibly causing it to miss."}` — **NO `automation` field**, no acBonus, no uses/maxUses. MA-0997 twin fingerprint.

## Actual (live)
Parry is inert prose. Zero affordance, zero machinery reachable.
- Fresh Knight 1 card (initiative 16, AC18, HP 52/52). Reactions row DOM verbatim:
  `<div class="mc-action "><strong>Parry.</strong> <span>The knight adds 2 to its AC against that attack, possibly causing it to miss.</span></div>`
  — row affordance scan `[]`; whole-modal scan: 0 parry/shield chips, 0 Expend affordance.
- Trigger probe: Bandit 1 own-card target-select swapped "Hobgoblin Warlord 1" → "Knight 1"; pressed Scimitar "+3" once → popup "✗ MISS (6 vs AC 18)". lastAttack: attacker Bandit 1, target Knight 1, weaponType melee, **targetAc 18, effectiveAc 18 (no +2)**, hit:false. Log entry parryAcBonus: **0**. No parry prompt/refusal/buff. Knight `activeBuffs`: ABSENT; **no `_parry*` runtime keys**.

## Grep evidence
- Gate: `getGatedMonsterReaction` — `const effect = action?.automation?.effect; return effect ? GATED_MONSTER_REACTIONS[effect] || null : null;` — MonsterCardHelpers.js:1530-1532. No automation ⇒ null.
- Modal route: `handleGatedReaction` — `if (!getGatedMonsterReaction(action)) return;` — MonsterCardModal.jsx:2089-2090. Silent return.
- `buildParryBuff` — `const acBonus = Number(action?.automation?.acBonus) || 2;` — MonsterCardHelpers.js:1235-1236; producer only via gated resolveMonsterParry ⇒ dead for knight.
- Disk: automation.acBonus owners in monsters.json = Bandit Captain 2, Death Knight 6, Death Knight Aspirant 4, Drow Elite Warrior 3, Erinyes 4, Gladiator 3 — **knight absent**.
- MA-0341 authored template (bandit-captain reactions[0]): `automation:{type:"reaction",trigger:"melee_hit",effect:"parry",acBonus:2}` + `usage:"At Will", uses:999, maxUses:999`.

## Fix (MA-0341 template, public/data/monsters.json knight reactions[0])
```json
"automation": { "type": "reaction", "trigger": "melee_hit", "effect": "parry", "acBonus": 2 },
"usage": "At Will", "uses": 999, "maxUses": 999
```

## Notes
- Scimitar press was a natural miss (6 vs AC 18); RAW trigger is "hit by" — but the automation gate makes parry unreachable regardless of hit/miss (same conclusion as MA-0997).
- Log ring 500 (cap) — new attack entry appended honestly; console errors **0** whole session.
- Cleanup: modal closed, Bandit 1 target-select restored to prior "Hobgoblin Warlord 1", Knight stays, no clears. Manifest untouched.
