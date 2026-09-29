# MA-1552 — Swarm of Bats "Bites" — FAIL(a)/DATA

## Verdict
**FAIL(a)/DATA** — data twin of MA-0485 / MA-0756. The Bloodied variant clause is prose-only; the manifest carries no structured `conditional_damage`, so the app presents base-only 2d4 Piercing with **zero Bloodied variant chooser** in both healthy and Bloodied states (zero-delta confirmed).

## ROW (manifest)
```json
{"id":"MA-1552","monster":"Swarm of Bats","monsterIndex":"swarm-of-bats","actionName":"Bites","actionType":"attack","attackBonus":4,"damageDicePrimary":"2d4","damageTypePrimary":"Piercing","reach":"5 ft.","description":"Melee Attack Roll: +4, reach 5 ft. Hit: 5 (2d4) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied."}
```

## Expected (fingerprint, codified today — playbook L849/850 + MA-1363 fix)
The "or X dice if Bloodied" variant clause needs structured `conditional_damage:{dice,damage_type,condition}` riding the MA-0007 ChargeBonusOffer seam (GM-adjudicated offer even when healthy). Expected behaviour: pressing the "+4" chip and hitting surfaces a variant offer offering **1d4 Piercing** when Bloodied.

## PRIMARY CONFIRMED
`public/data/monsters.json` (`"index": "swarm-of-bats"`, actions[0] "Bites") carries only:
- `attack_bonus: 4`, `reach: "5 ft."`, `damage_dice_primary: "2d4"`, `damage_type_primary: "Piercing"`
- **NO `conditional_damage` field** — the Bloodied clause exists only in the `description` prose.

## Grep confirmation (step 4)
`src/components/encounter/MonsterCardHelpers.js`:
```js
export function buildChargeBonusOffer(action, name) {   // line 664
  const cd = action?.conditional_damage;                 // line 665
  if (!cd?.dice) return null;                          // line 666  <-- arms on cd?.dice ONLY
```
No `conditional_damage` ⇒ `buildChargeBonusOffer()` returns `null` for Bites ⇒ no MA-1363-style offer chrome is ever rendered, regardless of swarm HP. (Task cited :622; function sits at :664 after today's edits, same guard.)

## E2E evidence (test-campaign, localhost:5173, Playwright)

### Setup
Encounter Builder: exact "Swarm of Bats" + exact "Bandit" selected (Monster Count 2, XP 75) → Join Encounter → Swarm card opened (first click absorbed, §138) → Swarm Target combobox = "Bandit 1". Card chip rendering: `Bites. [+4] Melee Attack Roll: +4, reach 5 ft. Hit: 5 (2d4) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied.`

### State 1 — Healthy swarm (server cs: currentHp 11 / maxHp 11, 11 > 5.5 → NOT Bloodied)
- Chip pressed repeatedly. Popups seen: to-hit popup only ("Bites — d20 N +4 (+4 to hit)" with Advantage/Disadvantage toggles + HIT/MISS verdict) → damage popup.
- Misses (AC 12, miss needs d20 ≤ 7): d20 5→total 9 ✗MISS, d20 6→10 ✗MISS, d20 4→8 ✗MISS, d20 1→5 ✗MISS (Critical Miss!), d20 5→9 ✗MISS.
- Hit: d20 18 +4 = **✓ HIT (22 vs AC 12)** → damage popup **"2d4: 2, 2" — 4 Piercing damage applied to Bandit 1 — HP: 11 → 7**.
- **No variant/charge-style offer popup offering 1d4 Bloodied damage at any point** (healthy or otherwise).
- Log: attack entry d20=18 vs Bandit 1 AC 12 + damage entry `formula: "2d4", rolls [2,2], finalDamage 4, damageType Piercing, note "combined_damage_roll"` — no conditional/variant fields.

### State 2 — Force-Bloodied swarm (GM HP input → currentHp 5; server cs math: 5 ≤ 11/2 = 5.5 → Bloodied)
- Target still "Bandit 1"; +4 chip pressed → **✓ HIT (d20 11 +4 = 15 vs AC 12)** on first roll.
- Damage popup: **"2d4: 3, 1" — 4 Piercing damage applied to Bandit 1 — HP: 7 → 3**.
- **Zero delta vs healthy state**: no Bloodied offer popup, no 1d4 reduced-damage path, same base 2d4 formula.
- Server `lastAttack` (server-side, not DOM badge, §223): `{attackerName:"Swarm of Bats 1", targetName:"Bandit 1", d20:11, total:15, targetAc:12, hit:true, attackName:"Bites", damageFormula:"2d4", damageType:"Piercing", rawDamage:4, primaryDamage:4, actualDamage:4, rolls:[3,1], damageApplied:true}` — zero offer/conditional fields.
- Campaign-log damage entry: `formula: "2d4", rolls [3,1], finalDamage 4, damageType "Piercing"` — identical shape to healthy-state hit.

## Root cause
DATA: swarm-of-bats "Bites" lacks structured `conditional_damage`; `buildChargeBonusOffer` (MonsterCardHelpers.js:664, guard :666) arms on `cd?.dice` only, so the MA-0007/MA-1363 GM-adjudication offer never surfaces and the engine cannot roll the 1d4 Bloodied variant.

## Fix
Add to `public/data/monsters.json` → swarm-of-bats → actions[0] "Bites":
```json
"conditional_damage": { "dice": "1d4", "damage_type": "Piercing", "condition": "Bloodied" }
```
This arms the existing MA-1363 static-state offer chrome (condition text in offer head: "Bloodied: +1d4 Piercing?"), GM-adjudicated on the attack HIT popup, expected Hit 5 (2d4) base or 2 (1d4) when Bloodied.

## Cleanup (done)
Admin → Clear Change Data ✓, Clear Campaign Log ✓ (log file removed, 0 entries), initiative Clear ✓ (session monsters NPC 1/NPC 2 placeholders spawned by Clear were removed; tracker restored to party-only). Server change-data verified clean (`Swarm of Bats 1` key, `lastAttack`, monster combatSummary entries all gone). Only test-campaign touched.
