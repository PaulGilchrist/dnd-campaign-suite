# MA-1553 — Swarm of Beetles "Bites" — FAIL(a)/DATA

## Verdict
**FAIL(a)/DATA** — data twin of MA-0485 / MA-0756 / MA-1552. The "half of its hit points or fewer" variant clause is prose-only; the manifest carries no structured `conditional_damage`, so the app presents base-only 4d4 piercing with **zero half-HP variant chooser** in both healthy and half-or-fewer states (zero-delta confirmed live).

## ROW (manifest)
```json
{"id":"MA-1553","monster":"Swarm of Beetles","monsterIndex":"swarm-of-beetles","actionName":"Bites","actionType":"attack","attackBonus":3,"damageDicePrimary":"4d4","damageTypePrimary":"piercing","reach":"0 ft.","description":"Melee Weapon Attack: +3 to hit, reach 0 ft., one target in the swarm's space. Hit: 10 (4d4) piercing damage, or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer."}
```

## PRIMARY CONFIRMED
`public/data/monsters.json` (`"index": "swarm-of-beetles"`, actions[0] "Bites") carries only:
- `attack_bonus: 3`, `reach: "0 ft."`, `damage_dice_primary: "4d4"`, `damage_type_primary: "piercing"`
- **NO `conditional_damage` field** — the half-HP clause exists only in the `description` prose.

## Guard confirmation
`src/components/encounter/MonsterCardHelpers.js`:
```js
export function buildChargeBonusOffer(action, name) {   // line 664
  const cd = action?.conditional_damage;                 // line 665
  if (!cd?.dice) return null;                          // arms on cd?.dice ONLY
```
No `conditional_damage` ⇒ `buildChargeBonusOffer()` returns `null` for Bites ⇒ the MA-0007/MA-1363 GM-adjudicated offer chrome is never rendered, regardless of swarm HP.

## E2E evidence (test-campaign, localhost:5173, Playwright)

### Setup
Encounter Builder: exact "Swarm of Beetles" (CR 0.5, XP 100) + exact "Bandit" (CR 0.125, XP 25) selected — Monster Count 2, Total XP 125 → Join Encounter → initiative populated (Swarm of Beetles 1 init 15 HP 22/22, Bandit 1 init 2). Swarm card opened (portrait click; first click absorbed, §138). Card chip rendering matches ROW exactly: `Bites. [+3] Melee Weapon Attack: +3 to hit, reach 0 ft., one target in the swarm's space. Hit: 10 (4d4) piercing damage, or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer.` Swarm Target combobox = "Bandit 1".

### State 1 — Healthy swarm (server cs: currentHp 22 / maxHp 22; 22 > 11 → NOT half-or-fewer)
- Miss: to-hit popup **"d20 2 +3 (+3 to hit) — ✗ MISS (5 vs AC 12)"** — no variant offer.
- Hit: to-hit popup **"d20 14 +3 (+3 to hit) — ✓ HIT (17 vs AC 12)"** (Advantage/Disadvantage toggles + Done only, no variant chooser on the HIT popup).
- Damage popup: **"4d4: 2, 4, 4, 4" — 14 damage applied to Bandit 1 — HP: 14 → 0**. Base formula only; **no variant/charge-style offer popup offering 2d4 at any point**.
- Server `lastAttack` (cs, not DOM, §223): `{attackerName:"Swarm of Beetles 1", targetName:"Bandit 1", d20:14, bonus:3, total:17, targetAc:12, hit:true, attackName:"Bites", damageFormula:"4d4", damageType:"piercing", rawDamage:14, primaryDamage:14, actualDamage:14, rolls:[2,4,4,4], damageApplied:true}` — zero offer/conditional fields.

### State 2 — GM-dropped half-or-fewer swarm (HP spinner → currentHp 10; cs math: 10 ≤ 22/2 = 11 → clause active; Bandit 1 restored to 11/11 as target)
- Miss first: **"d20 8 +3 — ✗ MISS (11 vs AC 12)"** — no variant offer.
- Hit: **"d20 17 +3 (+3 to hit) — ✓ HIT (20 vs AC 12)"** — HIT popup offers nothing but Done.
- Damage popup: **"4d4: 4, 1, 1, 1" — 7 damage applied to Bandit 1 — HP: 11 → 4**.
- **Zero delta vs healthy state**: same base 4d4 formula, no 2d4 reduced path, no half-HP offer popup.
- Server `lastAttack`: `{d20:17, bonus:3, total:20, hit:true, attackName:"Bites", damageFormula:"4d4", rawDamage:7, primaryDamage:7, actualDamage:7, rolls:[4,1,1,1], damageApplied:true, conditional:null, variant:null}` while swarm cs 10/22.
- Campaign-log damage entries (both states): `formula:"4d4"` finalDamage 14 (rolls [2,4,4,4]) and finalDamage 7 (rolls [4,1,1,1]), damageType "piercing", target "Bandit 1", `conditional:null` on both — identical shape, no conditional/variant fields anywhere.

## Offers seen / absent
- Seen: to-hit popup (adv/dis toggles), base-damage popup, "click to dismiss"/Done chrome only.
- **Absent: any half-HP 2d4 variant offer / ChargeBonusOffer-style chooser** — in healthy and half-or-fewer states alike.

## Root cause
DATA: swarm-of-beetles "Bites" lacks structured `conditional_damage`; `buildChargeBonusOffer` (MonsterCardHelpers.js:664, guard :666 `!cd?.dice`) never arms, so the engine cannot roll or offer the 5 (2d4) half-HP variant.

## Fix
Add to `public/data/monsters.json` → swarm-of-beetles → actions[0] "Bites":
```json
"conditional_damage": { "dice": "2d4", "damage_type": "piercing", "condition": "half HP or fewer" }
```
(house shape, per MA-1552 fix). This arms the MA-1363 static-state offer chrome on the attack HIT popup, expected Hit: 10 (4d4) base or 5 (2d4) when the swarm has half its hit points or fewer.

## Cleanup (done)
Initiative Clear ✓ (Clear spawned session placeholders NPC 1/NPC 2, removed via per-card Remove NPC; server cs verified party-only, 14 players). Admin → Clear Change Data ✓ (`change-data` keys now `[]`, no `Swarm`/`Bandit`/`lastAttack` keys), Clear Campaign Log ✓ (log count 0). Only test-campaign touched.
