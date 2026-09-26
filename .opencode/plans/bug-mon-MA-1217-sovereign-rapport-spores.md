# bug-mon-MA-1217-sovereign-rapport-spores

## Title
Myconid Sovereign "Rapport Spores" (MA-1217): inert for its RAW telepathy grant, and the junk "+0" attack chip adjudicates bogus zero-damage to-hit rolls (byte-twin of MA-1212)

## Overview
MA-1217 (myconid-sovereign actions[4], "Rapport Spores") is a zero-number, purely narrative row (30-ft Emanation; INT≥2 non-Construct/Elemental/Undead gain telepathy 30 ft for 1 hour; no attack roll, no save, no dice). Disk authors no automation, no §6 RAW-unlimited sentinel, no effect key, and no zone dict, so no consumer exists to record the telepathy grant. The row's disk shape is byte-equivalent to MA-1212's myconid-adult actions[2] FAIL(b) row (same fields: `attack_bonus: 0`, `save_dc: 0`, `save_effect: ""`, `save_type: ""`, `range: ""`, `reach: ""`, `recharge: ""`, identical description text). Worse than inert: `attack_bonus: 0` (not null) makes MonsterAction render a clickable "+0" junk chip that adjudicates a full wrong-model to-hit attack vs the armed target and mutates attacker state (`lastAttackRoll`, `_lastRollContext`) on every press.

## Expected (quote)
Manifest/disk description verbatim:

> "The myconid expels spores in a 30-foot Emanation originating from itself. Creatures in that area with an Intelligence score of 2 or higher that aren't Constructs, Elementals, or Undead gain telepathy with a range of 30 feet for 1 hour."

There is no attack roll in RAW. Per §6 RAW-unlimited honest sentinel, the sanctioned shape for an ever-available record-only action is `usage: "At Will"` + `uses: 999` + 1/round latch (MA-0006/0300/0305 precedent), producing a recording-only `ability_use` log entry (telepathy effect itself may stay narrative advisory per the MA-0006 family). Per §117, an unauthored no-affordance row must be inert.

## Actual
- Disk `public/data/monsters.json` myconid-sovereign actions[4]: NO `automation`, NO `usage`/`uses`, NO effect key, NO `zone` dict; `attack_bonus: 0`, `save_dc: 0`, `save_type: ""`, `save_effect: ""`, `range: ""`, `reach: ""`, `recharge: ""` — field-for-field identical to myconid-adult actions[2] (MA-1212 byte-twin confirmed, same session lineage).
- Grep consumers: `rapport_spores` src+server rc=1 ZERO. "rapport" hits are only the `MonsterCardModal.jsx:113` DC0-decoy comment + MA-1071 gate test. "telepathy" hits are advisory copy (`monsterAbilityUses.js:7`, `saveProcessing.js:1098` "GM-enforced") and the 2024 Telepathy FEAT validator — no monster-row consumer. "emanation" hits are sorcerer Warping Implosion / Darkmantle zone-dict Aura code that never engages (this row has no zone dict). §159 MA-0317 precedent (grep-zero = PASS-impossible) applies.
- Live card census (test-campaign header verified, fresh Sovereign 1 HP45 AC13, Bandit victim 999/11 armed, cs.targetName server-confirm): Rapport row = exactly ONE `span.mc-dice-link` "+0" clickable chip (§490 junk family); ZERO DC chip, ZERO "At Will" sentinel, ZERO record/zone affordance.
- Press ×2 (real pointer, row-scoped fresh-rect, log-delta + tail-count §488 arbiter): 1:1 tail = two bogus `roll / rollType:"attack" / name:"Rapport Spores"` entries — nat19 total:19 bonus:0 `hit:true damageType:null` (silent zero-damage "hit") and nat1 total:1 `hit:false` vs Bandit AC12. Mutates `Myconid Sovereign 1.lastAttackRoll` (attackName:"Rapport Spores", targetAc:12) + `_lastRollContext` (damageFormula:null) and global `lastAttack` in change-data.
- Zero sanctioned record: no rapport/telepathy `ability_use`, no te on victim (Bandit change-data key absent), Bandit currentHp unchanged 999/11, no conditions, zero damage/hp_change entries. (Two pre-existing `ability_use` expiry-sweep noise entries attributed to Sovereign — "Rest; Flesh to Stone ends" / "Rest; Prismatic Spray Indigo/Violet effects ends" — are stale prior-session duration cleanup, not Rapport records.)
- First unscoped click pair at stale rect hit the header Initiative chip instead (bogus Sovereign initiative re-roll total:12) — board-corruption near-miss recorded, excluded from row ledger per audit-before-refire MA-543.
- Console: 0 errors.

## Steps
1. `npm run dev` (dev already running, no restart; :5173 and :80 both 200); open http://localhost:5173, select test-campaign (header verified).
2. Clean board (cs null, log empty). Encounters → exact `td[1]==='Myconid Sovereign'` row checkbox (checked=true) → Join Encounter → Initiative shows Myconid Sovereign 1 HP45/45.
3. +NPC → anchor NEW NPC card `.monster-autocomplete-input` (§490), type Bandit, `li.textContent==='Bandit'` exact, Escape+blur, TRUSTED currentHp 999 fill+Enter (server 999/11, maxHp authored 11).
4. Arm Bandit on Sovereign own-card target-select; `cs.creatures[attacker].targetName==='Bandit'` server-confirm.
5. Open Sovereign card → Rapport Spores row: only a clickable "+0" chip (no sanctioned affordance).
6. Press "+0" chip ×2 (row-scoped fresh-rect real pointer): two bogus `roll/attack "Rapport Spores"` log entries (one zero-damage hit, one miss), lastAttackRoll/_lastRollContext/lastAttack mutated; no ability_use sentinel, no rapport/telepathy effect, no damage, no victim state.

## Likely Location
- `public/data/monsters.json` myconid-sovereign actions[4] — missing the sanctioned §6 sentinel block (`usage:"At Will"`/`uses:999`) and/or `attack_bonus:null`; same dirty-row shape as myconid-adult actions[2].
- `src/components/encounter/MonsterAction.jsx:338` — `attackHasAttack = action.attack_bonus != null` treats authored `attack_bonus: 0` as a real attack; DC0/save-less narrative rows get the "+0" junk chip (MA-0551 save-leg nulling never mirrored to the attack leg; ungated for both Myconid family members).
- No emanation/telepathy consumer anywhere (grep-zero): the RAW 30-ft emanation telepathy grant has no recording mechanism app-wide.

## Notes
- Byte-twin of `bug-mon-MA-1212-rapport-spores.md` (same session): identical disk shape, identical junk-chip census, identical bogus press behavior. ONE fix serves both rows: gate/null the attack leg + author the §6 sentinel (or structured advisory te with registered consumer) for the Rapport Spores family (adult + sovereign).
- If the sovereign fix lands, re-verify MA-1212 and MA-1217 together as a family pair.
- Manifest not edited; no git writes; test-campaign only.
