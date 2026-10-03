# BUG — CLA-037 Bewitching Magic (2024 Warlock, Archfey Patron lv14) — VERIFIED: FAIL(b) INERT

## Expectation (public/data/2024/classes.json[10] Warlock → majors[0] Archfey Patron → features[3], lv14)
"Immediately after casting an Enchantment or Illusion spell using an action and a spell slot, cast Misty Step as part of the same action without expending a spell slot."
Automation metadata: `{type:"bewitching_magic", casting_time:"passive"}`. Manifest owner "Warlock" confirmed; subclass+level from data (manifest stale). Manifest handler path (combat/automation/handlers/classFeatureHandler.js) STALE — real chain below.

## Defect 1 (PRIMARY, inert auto rider): casting_time casing gate mismatch
- Rider: `spellCastService/execution/index.js:509 runPostCastTriggers → postCastRiderService.triggerBewitchingMagic (:238)`.
- `postCastRiderService.js:247`: `if (spell.casting_time !== '1 action') return null;`
- 2024 spells.json casing is `'Action'` / `'Bonus Action'` (verified: Charm Person, Phantasmal Force, Blink = 'Action'). LIVE proof: campaign log spell entries stamp `castingTime:"Action"` (Burning Hands + Minor Illusion + Blink log entries this session).
- ⇒ Gate NEVER passes for 2024 data; the only 2014-style `'1 action'` spelling exists in 5e data. CLA-033 checkpoint already flagged: "rider gate doesn't check casting_time — only bewitching_magic does".
- School gate (:10-13) and slot gate (:243, usesSpellSlot) DO pass live (Phantasmal Force lv5 slot, Illusion) — the function returns at the casting_time line before reaching `executeHandler`. Feature inert on every lane that reaches runPostCastTriggers.

## Defect 2 (manual lane refusal + no producer): lastAttack.spellSchool never written
- Manual row: Special Actions "Bewitching Magic:" renders clickable (automationService.js:41 lists bewitching_magic). Handler `bewitchingMagicHandler.js:17-23` gates on `lastAttack.spellSchool || action.school || lastAttack.damageSchool` ∈ {enchantment, illusion}.
- LIVE: pressed the row IMMEDIATELY after casting Phantasmal Force (Illusion lv5 slot, save lane completed, damage applied) → refusal popup verbatim: "Bewitching Magic requires that your last spell cast was an enchantment or illusion spell."
- Producer census: zero code writes `spellSchool` into `campaign/lastAttack` (grep: only readers: bewitchingMagicHandler.js:21). Spell-save lane stamp (`handleNpcSaveDamage.storeSaveLastAttack`, live stamp: `{attackerName:"HexWarlock", attackName:"Phantasmal Force", rollType:"spell-save", saveType:"INT", saveDc:16, …}`) carries NO spellSchool; damageType also null in the pre-roll stamp → `damageSchool` fallback cannot rescue. Gate is unsatisfiable by design for spell casts.
- Pre-cast press refusal also live (identical popup, lastAttack null) — refusal lane works, positive lane unreachable.

## Defect 3 (latent, on-fix blockers — must be re-verified after fixing 1+2)
- Handler reuses foreign resource `_Steps_of_the_Fey_freeCastCount` (bewitchingMagicHandler.js:29) — Bewitching Magic has NO uses limit in data; every consumed modal path decrements the Steps-of-the-Fey lv3 charge (`StepsOfTheFeyTauntModal.jsx:55-60`). Host runtime stamped `_Steps_of_the_Fey_freeCastCount:0` at subclass save ⇒ even if fired, modal `hasUses=newCount>0` grays all choices.
- No campaign-log entry on the plain free-cast path (`handleFreeCastSkip` :98-102 sets text only, no addEntry) — violates "every automation must log" (AGENTS.md). Modal skip button is honestly labeled 'Misty Step only (free cast)' for title==='Bewitching Magic' (:333), no slot/count burn there.
- No teleport execution anywhere: modal never moves position/token; "part of the same action" unrepresented (no te, no pending key, no position write).

## Live evidence log (test-campaign, 2026-10-03, HexWarlock lv14 2024, subclass EDITED Great Old One→Archfey Patron via step-7 wizard)
Rig: +NPC Bandit (AC12, HP→999 UI fill; % HP label display quirk benign), armed on HexWarlock tracker card (cs.creatures.HexWarlock.targetName='Bandit' GET-confirmed). Slots lv5=3, `_Steps`=0, lastAttack=null at baseline.
1. Manual press PRE-cast → refusal popup (text above). ✔ refusal lane alive.
2. Phantasmal Force (Illusion lv2→lv5 slot, ungated) cast → slot lv5 3→2 exact; Bandit INT save DC16 fail 11 dmg; log spell/ability_use/roll/hp_change 4 entries. Bewitching affordance: NONE (no modal, no popup, no pending/bewitch keys in change-data poll, _Steps unchanged 0).
3. Manual press POST-cast (same turn, immediately) → refusal popup again ⇒ defect 2 proven.
4. CONTROL Minor Illusion (Illusion cantrip, no slot): cast, spellLevel 0, lv5 stays 2, no bewitching — correct outcome, passes only via slot-gate, not proof of rider.
5. CONTROL Blink (Transmutation lv3→lv5 slot): cast, lv5 2→1 exact, no bewitching — correct outcome for school gate.
6. CONTROL Burning Hands: cast logged lv5 7d6 `castingTime:"Action"` but slot NOT consumed — Magic Initiate feat free-cast lane (popup "Free Cast — no spell slot consumed"); excluded as slot-economics control (documented; feature-slot evocation control = Blink).
7. Whole-log grep bewitch/misty = 0 entries. Poll cadence ≥8s (10s cache honored).

## Slot economics verdict-support
Only Phantasmal Force and Blink burned slots (3→2→1, delta exactly 1 per cast); no double-charge; but since Bewitching never fires, "no slot cost for the free Misty Step" is vacuously unmet — feature never grants the free cast.

## Controls coverage
(a) non-Ench/Illusion slot spell: Blink ✔ (correctly inert); (b) cantrip: Minor Illusion ✔; (c) bonus-cast Enchantment: N/A — holder has none on sheet (Misty Step=Conjuration, Hex=necromantic utility); (d) uses limit: data defines none for bewitching_magic (no uses/recharge keys) — N/A; foreign _Steps gate noted in defect 3.

## Fix pointers
postCastRiderService.js:247 — normalize casing (e.g. `(spell.casting_time||'').toLowerCase().replace(/^1\s+/,'').trim()==='action'` or accept both 'Action' and '1 action'); and/or stamp `spellSchool` into lastAttack from the spell-save/cast lane so the manual handler gate can ever pass. Then re-verify free-cast modal semantics (drop Steps-charge decrement for bewitching title, add log entry, execute teleport or document advisory).

## Host / cleanup
Host: HexWarlock lv14, rules 2024, CHA 17/+3, DC16, lv5 slots 3. Subclass EDIT Great Old One→Archfey Patron for the run, then REVERTED to Great Old One Patron (disk-verified, spells list untouched = 11) to preserve CLA-402/CLA-053 GOO hosts; Archfey swap is a proven 30s step-7 recipe for retest. Board FULL RESET via native Admin (two native confirms): change-data {} + log [] server-verified, stable 25s after tab close (no resurrection). No other production touched.

## REUSABLE RECIPE (CLA-037 lane)
- Host: HexWarlock (test-campaign) now Archfey Patron lv14 2024 — Bewitching Magic (+ Steps of the Fey bonus row + Misty Escape reaction + Immune: Charmed) on sheet; Bewitching row clickable; lv5 slots 3.
- Rig: Initiative +NPC autocomplete exact-li 'Bandit' → UI-fill current HP 999+Enter (% HP label is display quirk); arm own-card tracker select (self-excluded) → GET-confirm creatures.HexWarlock.targetName.
- Cast lane: spell-table cell click → inline popup, level radios (only lv5 enabled+checked for warlock), 'Cast Spell' → AOE picker (checkbox per creature + 'Spell (N)' confirm) → results .sp-overlay → Close; poll change-data ≥8s.
- Bewitching manual probe: Special Actions `<b class="clickable">Bewitching Magic:</b>`; refusal popup = fixed panel `generic "…click to dismiss"` + button 'Done'.
- Pitfalls: pre-existing combatSummary placeholder join (14 PCs @1/1 HP) on campaign open; Magic Initiate spells render "Free Cast — no spell slot consumed" — do not use for slot-economics; casting_time casing 'Action' live-stamped in log.
