# bug-mon-MA-1220-sprout-rapport-spores

## Title
Myconid Sprout "Rapport Spores" (MA-1220): inert for its RAW telepathy grant, and the junk "+0" attack chip adjudicates bogus zero-damage to-hit rolls (third byte-twin of MA-1212 / MA-1217)

## Overview
MA-1220 (myconid-sprout actions[1], "Rapport Spores") is a zero-number, purely narrative row (30-ft Emanation; INT≥2 non-Construct/Elemental/Undead gain telepathy 30 ft for 1 hour; no attack roll, no save, no dice). Disk authors no automation, no §6 RAW-unlimited sentinel, no effect key, and no zone dict, so no consumer exists to record the telepathy grant. The row's disk shape is byte-equivalent to MA-1212's myconid-adult actions[2] and MA-1217's myconid-sovereign actions[4] FAIL(b) rows (same fields: `attack_bonus: 0`, `save_dc: 0`, `save_type: ""`, `save_effect: ""`, `range: ""`, `reach: ""`, `recharge: ""`, identical description text). Worse than inert: `attack_bonus: 0` (not null) makes MonsterAction render a clickable "+0" junk chip (§490 family) that adjudicates a full wrong-model to-hit attack vs the armed target and mutates attacker state (`lastAttackRoll`, `_lastRollContext`, global `lastAttack`) on every press. This is the THIRD byte-twin in the Rapport Spores family, third identical FAIL(b) in the same session lineage.

## Expected (quote)
Manifest/disk description verbatim:

> "The myconid expels spores in a 30-foot Emanation originating from itself. Creatures in that area with an Intelligence score of 2 or higher that aren't Constructs, Elementals, or Undead gain telepathy with a range of 30 feet for 1 hour."

There is no attack roll in RAW. Per §6 RAW-unlimited honest sentinel, the sanctioned shape for an ever-available record-only action is `usage: "At Will"` + `uses: 999` + 1/round latch (MA-0006/0300/0305 precedent), producing a recording-only `ability_use` log entry (telepathy effect itself may stay narrative advisory per the MA-0006 family). Per §117, an unauthored no-affordance row must be inert.

## Actual
- Disk `public/data/monsters.json` myconid-sprout actions[1] (actions array length 2): NO `automation`, NO `usage`/`uses`, NO effect key, NO `zone` dict; `attack_bonus: 0`, `save_dc: 0`, `save_type: ""`, `save_effect: ""`, `range: ""`, `reach: ""`, `recharge: ""` — field-for-field identical to myconid-adult actions[2] (MA-1212) and myconid-sovereign actions[4] (MA-1217). THREE-WAY byte-twin confirmed.
- Grep consumers: `rapport_spores` src+server rc=1 ZERO. "rapport" hits = only the `MonsterCardModal.jsx:113` DC0-decoy comment. "telepathy" hits = advisory copy only (`monsterAbilityUses.js:7`, `saveProcessing.js:1098` "GM-enforced") + 2024 Telepathy FEAT validator — no monster-row consumer. Emanation hits are zone-dict Aura/test code that never engages (this row has no zone dict). §159 MA-0317 precedent (grep-zero = PASS-impossible) applies.
- Live card census (test-campaign header verified, fresh Sprout 1 idx0 HP 3/3 AC10 disk-exact, Bandit victim 999/11 AC12 armed, cs.creatures[0].targetName==='Bandit' server-confirm): Rapport row (`div.mc-action`) = exactly ONE `span.mc-dice-link` "+0" clickable chip (§490 junk family); ZERO DC chip, ZERO "At Will" sentinel, ZERO record/zone affordance.
- Press ×2 (real pointer, row-scoped fresh-rect, tail-count §488 arbiter, backdrop flush between presses §453): 1:1 exactly two new entries — both `roll / rollType:"attack" / name:"Rapport Spores" / bonus:0` — nat12 total:12 and nat15 total:15, `hit:true damageType:null` vs Bandit AC12 (double silent zero-damage "hits"); press→log zero-absorbed.
- Attacker-state mutation: `Myconid Sprout 1.lastAttackRoll` (attackName:"Rapport Spores", d20:15, bonus:0, targetAc:12, hit:true) + `_lastRollContext` (type:"attack", damageFormula:null) + global `lastAttack` (targetName:"Bandit", hit:true) in change-data.
- Zero sanctioned record: no rapport/telepathy `ability_use` (0 whole log), no te on victim (Bandit change-data store-key ABSENT — strongest proof §443), Bandit cs hp held 999/11, zero damage/hp_change entries, no conditions.
- Console: 0 errors (2 pre-existing benign warnings: apple-mobile meta, class_level_scaling).

## Steps
1. `npm run dev` (dev already running, no restart; :5173 and :80 both 200); open http://localhost:5173, select test-campaign (header verified).
2. Clean board (log=[], cs null). Encounters → search "Myconid" → exact `td[1]==='Myconid Sprout'` row checkbox native cb.click() checked=true first try → Join Encounter → Initiative shows Myconid Sprout 1 HP 3/3 idx0 (AC10 disk-exact).
3. +NPC → anchor NEW pre-filled 'NPC 1' card `.monster-autocomplete-input` (§490 rename-field shares class, idx0 is Sprout rename — untouched), Meta+A+type Bandit, `li.textContent==='Bandit'` exact click, Escape+blur; TRUSTED currentHp 999 fill+Enter on `input[aria-label="Bandit current HP"]` (server 999/11, maxHp stays authored 11).
4. Arm Bandit on Sprout own-card target-select (idx0, options self-exclude Sprout itself); `cs.creatures[0].targetName==='Bandit'` server-confirm.
5. Open Sprout card (real-pointer click `.npc-avatar`) → Rapport Spores row: only a clickable "+0" chip (no sanctioned affordance).
6. Press "+0" chip ×2 (row-scoped fresh-rect real pointer, §488 tail-count): two bogus `roll/attack "Rapport Spores"` entries bonus:0 nat12/nat15 both hit:true damageType:null; lastAttackRoll/_lastRollContext/lastAttack mutated; no ability_use sentinel, no rapport/telepathy effect, no damage, no victim state.

## Likely Location
- `public/data/monsters.json` myconid-sprout actions[1] — missing the sanctioned §6 sentinel block (`usage:"At Will"`/`uses:999`) and/or `attack_bonus:null`; same dirty-row shape as myconid-adult actions[2] and myconid-sovereign actions[4].
- `src/components/encounter/MonsterAction.jsx:338` — `actionHasAttack = action.attack_bonus != null` treats authored `attack_bonus: 0` as a real attack; DC0/save-less narrative rows get the "+0" junk chip (MA-0551 save-leg nulling never mirrored to the attack leg; ungated for all three Myconid family members).
- No emanation/telepathy consumer anywhere (grep-zero): the RAW 30-ft emanation telepathy grant has no recording mechanism app-wide.

## Notes
- THIRD byte-twin of the Rapport Spores family: `bug-mon-MA-1212-rapport-spores.md` (Adult) and `bug-mon-MA-1217-sovereign-rapport-spores.md` (Sovereign) — identical disk shape, identical junk-chip census, identical bogus press behavior. ONE fix serves all three rows (MA-1212 / MA-1217 / MA-1220): gate/null the attack leg (`attack_bonus:null`) + author the §6 sentinel (`usage:"At Will"`/`uses:999`) or structured advisory te with registered consumer, applied across the myconid-adult / myconid-sovereign / myconid-sprout Rapport Spores rows.
- Whichever shape, the junk "+0" to-hit press must stop emitting `roll/attack` entries and mutating lastAttackRoll/_lastRollContext/lastAttack for this family — a RAW no-attack action silently adjudicating "hit" with zero damage is garbage adjudication (zero-damage-hit bad-shape family).
- If the family fix lands, re-verify MA-1212, MA-1217, and MA-1220 together as a triple.
- Board cleanup done via Admin UI buttons: log=[] cd={} cs value:null, 15s quiet.
- Manifest not edited; no git writes; test-campaign only.
