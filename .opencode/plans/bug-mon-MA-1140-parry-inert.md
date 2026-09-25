# MA-1140 — Marilith Parry: prose-only reaction row, zero automation = fully inert (FAIL(b)/DATA)

## Overview
Marilith's `Parry` reaction (public/data/monsters.json, `reactions[0]`) carries only `name`/`trigger`/`description` — no `automation` dict, no `usage`/`uses`, no `ac_bonus`. The gated-reaction renderer and the live parry AC channel both key **solely** on `automation.effect`, so the row renders as plain inert prose and the "+5 to its AC" number never touches combat math. Confirmed live in test-campaign: 10 Bandit 1 melee attacks vs Marilith AC 16, including two qualifying hits inside the would-be-parry window — zero parry affordance, zero AC delta, zero parry log entries. Exact MA-0643 / MA-0573 / MA-0702 / MA-0869 / MA-0997 / MA-1048 fingerprint.

## Expected (authored row)
```json
{"id":"MA-1140","monster":"Marilith","monsterIndex":"marilith","actionIndex":0,
 "actionName":"Parry","category":"reactions","actionType":"other",
 "trigger":"The marilith is hit by a melee attack roll while holding a weapon",
 "description":"The marilith adds 5 to its AC against that attack, possibly causing it to miss."}
```
Per the row, when the marilith is hit by a melee attack, a Parry affordance should let it add +5 to AC against that attack (AC 16 → 21), flipping any hit totalling 16..20 to a miss.

## Actual
- Disk `monsters.json` marilith `reactions[0]` keys = `['description','name','trigger']` ONLY — no `automation`, no `acBonus`, no `usage`/`uses`. AC 16.
- Live card: Parry row renders `<strong>Parry.</strong> <span>The marilith adds 5 to its AC…</span>` — `links/buttons/role=button = 0`; all 13 card chips belong to attacks/saves/skills/Multiattack — none for Parry. No gated reaction slot.
- 10 Bandit 1 Scimitar (+3) attacks vs AC 16: nats 9,4,18,8,20,4,3,8,1,13 → totals 12,7,21,11,23,7,6,11,4,16. Every attack log entry stamped `effectiveAc:16, parryAcBonus:0`.
- Qualifying hits landed INSIDE the would-be-parry window [16,20]: nat13+3=**16 vs AC 16** (Done applied −3, HP 215→212) and nat18+3=21 / nat20 CRIT →23 (−5) — AC never raised to 21, no conversion, full damage applied.
- Near-miss window 12..15 exercised: nat9+3=12 MISS, uneventful.
- Whole-log parry scan (filtered on abilityName/automationType, not substring): `automation:0, ability_use:0, parry_refused:0, parry_consumed:0`. Marilith change-data: **store key absent entirely** (no `activeBuffs`, no `MONSTER_REACTION_USES` — §MA-1116 absent-key discriminator).
- No reaction prompt popup ever appeared; pending popups carried only `Done`/`click to dismiss`.

## Steps to Reproduce
1. test-campaign → Encounters: check exactly `[Bandit, Marilith]` (exact td-text; Bandit Captain/Deceiver/Crime Lord unchecked) → Join Encounter.
2. Initiative: Marilith 1 (init 19, AC 16, hp 220), Bandit 1 (init 4). Arm Bandit 1's own initiative-card target select to "Marilith 1" (verified `targetName:"Marilith 1"` in cs).
3. Open Bandit 1 card → Scimitar "+3" chip; fire repeatedly (10 fired), pressing **real-pointer Done** on hit popups while the attacker modal is open (defender-card-open orphans the pending damage resolver — §MA-0895; one early nat18 hit had to be re-shot).
4. Before and after each hit, probe: Marilith card (avatar click opens over pending popup) → Parry row + chips; Marilith change-data keys; popup content; attack log `parryAcBonus`/`effectiveAc`.
5. Observe: zero affordance before, during, and after hits; `parryAcBonus:0` + `effectiveAc:16` on every entry; in-window hit nat13→16 applies full damage; zero parry log lines.

## Likely Location
- **DATA (root cause):** `public/data/monsters.json` marilith `reactions[0]` — missing `automation` block.
- **Gate:** `getGatedMonsterReaction` src/components/encounter/MonsterCardHelpers.js:1556-1559 — `action?.automation?.effect` only → null for prose rows → no chip (MonsterAction.jsx:165) and resolver early-return (`resolveMonsterGatedReaction` :1636 dispatch; MonsterCardModal.jsx:2139 guard).
- **Consumer chain (live, unreached):** `resolveMonsterParry` Helpers:1284 → `buildParryBuff` Helpers:1261 (`automation.acBonus`, default 2) stamps `activeBuffs {effect:'parry', acBonus}` → `getParryAcBonus` src/hooks/combat/loggedDiceRollUtils.js:74-80 → folded into AC at src/hooks/combat/hitResolution.js:284 (`+ (context._parryAcBonus || 0)`), read at src/hooks/combat/useLoggedDiceRollAttack.js:485. No consumer anywhere keys off prose name/trigger (grep: `parry` consumers = parry-buff-channel only).

## Fix (per MA-0341 Bandit Captain template, acBonus scaled to row text)
One automation block on marilith `reactions[0]`:
```json
"automation": {"type":"reaction","trigger":"melee_hit","effect":"parry","acBonus":5},
"usage": "At Will", "uses": 999, "maxUses": 999
```
`acBonus` MUST be **5** (row text "adds 5 to its AC"; Bandit Captain twin ships 2, erinyes 4, drow elite 3 — data-driven per monster). CamelCase automation keys per MA-0643/0681 byte-shape convention.

## Notes
- MA-0643 precedent (Drow Elite Warrior) and family twins MA-0565/0573 (Death Knight Aspirant), MA-0702 (Erinyes), MA-0869 (Gladiator), MA-0997 (Hobgoblin Warlord), MA-1048 (Knight) — identical fingerprint, all fixed with the one-field template.
- Marilith also has `Reactive` ("one Reaction on every turn of any other creature") — RAW unlimited parries; the §60 At-Will sentinel (`usage:"At Will"` + `uses/maxUses:999`) matches that intent; round-latch keeps it to 1/turn.
- Wielding-a-weapon trigger is GM-enforced (no equip model) — same caveat as all parry twins (buildParrySpendLog prose, Helpers:1273).
- Cosmetic log quirk observed (§414 family): attack-log `total` mirrors the nat (rolls:[18,15] total:18) while popup prints correct nat+bonus=21 — popup + damage/hp_change entries are decisive.
- `parryAcBonus:0` rides EVERY attack entry — never judge parry by substring scan (§111).

## Registry suggestion
```
"MA-1140": {"actionName":"Parry","actionType":"other","verdict":"FAIL(b)-DATA no-automation (MA-0643 twin)",
"note":"marilith reactions[0] keys name/trigger/description only, AC16; 10 Bandit Scimitar +3 probe nats 9/4/18/8/20C/4/3/8/1/13 — hits 21, 23crit(−5), 16(−3 in would-be-parry window [16,20]) unconverted, near-miss 12; every entry effAc:16 parryAcBonus:0; zero chip (row HTML strong+span only), zero prompt, zero automation/ability_use/refused log, marilith change-data key ABSENT (§absent-key discriminator); gate getGatedMonsterReaction Helpers:1556 keys automation.effect only; acBonus channel loggedDiceRollUtils:74→hitResolution:284 live unreached; fix automation{type:reaction,trigger:melee_hit,effect:parry,acBonus:5}+At Will 999 MA-0341 template"}
```
