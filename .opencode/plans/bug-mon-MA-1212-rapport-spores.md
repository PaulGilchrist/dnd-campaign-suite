# bug-mon-MA-1212-rapport-spores

## Title
Myconid Adult "Rapport Spores" (MA-1212): inert for its RAW effect, and the junk "+0" attack chip fires a wrong-model to-hit roll

## Overview
MA-1212 (myconid-adult actions[2], "Rapport Spores") is a zero-number, purely narrative row (telepathy 30 ft, 1 hour; no attack roll, no save, no dice). Disk authors no automation, no §6 RAW sentinel, no effect key, and no zone dict, so no consumer exists to record the telepathy grant. Worse, the row is NOT inert: `attack_bonus: 0` (not null) makes MonsterAction render a clickable "+0" attack chip that adjudicates a full wrong-model to-hit attack ("Rapport Spores" vs AC, hit/miss, zero damage) and mutates attacker state (`lastAttackRoll`, `_lastRollContext`) on every press. Prior sessions (MA-1210 registry note "junk chips NEVER pressed SS445") knew the chip existed but never pressed it; MA-1212 is the row whose ONLY affordance is that junk chip.

## Expected (quote)
Manifest/disk description verbatim:

> "The myconid expels spores in a 30-foot Emanation originating from itself. Creatures in that area with an Intelligence score of 2 or higher that aren't Constructs, Elementals, or Undead gain telepathy with a range of 30 feet for 1 hour."

There is no attack roll in RAW. Per §6 RAW-unlimited honest sentinel, the sanctioned shape for an ever-available record-only action is `usage: "At Will"` + `uses: 999` + 1/round latch (MA-0006/0300/0305 precedent), producing a recording-only `ability_use` log entry (telepathy effect itself may stay narrative advisory per the MA-0006 family). Per §117, an unauthored no-affordance row must be inert.

## Actual
- Disk `public/data/monsters.json` myconid-adult actions[2]: byte-row has NO `automation`, NO `usage`/`uses`, NO effect key, NO `zone` dict. `attack_bonus: 0`, `save_dc: 0`, `save_type: ""`, `save_effect: ""`, `range: ""`, `recharge: ""`.
- Grep consumers: zero for rapport/rapport_spores/telepathy targetEffect. `MonsterCardModal.jsx:113` names this exact row as a "DC0 decoy" that never arms the area picker. `targetEffectDefinitions.js` has no rapport/telepathy/emanation entry. `saveProcessing.js:1098` + `monsterAbilityUses.js:7` only carry generic "control/telepathy … GM-enforced" advisory copy.
- Live card census (test-campaign, fresh Myconid Adult 1, Bandit victim armed, cs.targetName server-confirm): Rapport row = exactly ONE `span.mc-dice-link` "+0" (clickable, MonsterAction.jsx:338 `attack_bonus != null`); ZERO DC chip, ZERO "At Will" sentinel chip, ZERO record/zone affordance.
- Press ×2 (real pointer, popup-overlay flushed SS453): log-delta 1:1 two entries `roll / rollType:"attack" / name:"Rapport Spores" / bonus:0` — nat15 total:15 `hit:true` with `damageType:null` and NO roll_damage entry (silent zero-damage "hit"), nat10 total:10 miss vs Bandit AC12. Mutates `Myconid Adult 1.lastAttackRoll` + `_lastRollContext` in change-data.
- Zero `ability_use` anywhere, zero te "rapport"/telepathy on victim (Bandit change-data store = {}), Bandit currentHp unchanged 999/11, no conditions applied.
- Console: 0 errors (2 pre-existing benign warnings: apple-mobile meta, class_level_scaling).

## Steps
1. `npm run dev` (dev already running, no restart); open http://localhost:5173, select test-campaign (header verified).
2. Admin/initiative clean board (cs null). Encounters → check row with exact `td[1]==='Myconid Adult'` → Join Encounter (auto-navigates to Initiative; Myconid Adult 1 HP16 AC12).
3. +NPC → autocomplete `li.textContent==='Bandit'` exact → fill TRUSTED currentHp 999 (server 999/11). Arm Bandit on Myconid own-card target combobox; cs.targetName==='Bandit' server-confirm.
4. Open Myconid Adult card → Rapport Spores row: only a clickable "+0" chip (no sanctioned affordance).
5. Press "+0" chip ×2: two bogus `roll/attack "Rapport Spores"` log entries (one zero-damage hit), lastAttackRoll/_lastRollContext mutated; no ability_use sentinel, no rapport/telepathy effect, no damage, no victim state.

## Likely Location
- `src/components/encounter/MonsterAction.jsx:338` — `actionHasAttack = action.attack_bonus != null` treats authored `attack_bonus: 0` as a real attack; DC0/save-less narrative rows get the "+0" junk chip (cf. MA-0551 `Number(save_dc) > 0` convention applied to saves but not to attack_bonus; MonsterCardModal.jsx:112-117 already documents this row as the DC0 decoy but the attack leg is ungated).
- `public/data/monsters.json` myconid-adult actions[2] — missing the sanctioned §6 sentinel block (and/or `attack_bonus: null`).

## Notes
- Data fix shape A (§6 sanctioned, matches MA-0006/0300/0305 ever-available record-only family): author `{ "usage": "At Will", "uses": 999 }` (+ existing 1/round latch) so the chip fires a recording-only `ability_use` "Rapport Spores" entry logging the telepathy-30ft-1-hour advisory (GM-enforced clause), with the attack leg neutralized (e.g. `attack_bonus: null` or route to the advisory resolver).
- Data fix shape B: structured advisory te (e.g. `rapport_spores`, duration 1 hour, exemption clause INT≥2 / no Constructs/Elementals/Undead in the payload) registered in `targetEffectDefinitions.js` with a chip + consumer; heavier new-state design, needs consumer wiring (none exists today — grep-zero).
- Whichever shape, the junk "+0" to-hit press must stop emitting `roll/attack` entries and mutating lastAttackRoll for this row — a RAW no-attack action silently adjudicating "hit" with zero damage is garbage adjudication (zero-damage-hit is a known bad shape family).
- Board cleanup done via Admin UI buttons: log=[] cd={} cs value:null ×2, 15s quiet.
- Manifest not edited; no git writes; test-campaign only.
