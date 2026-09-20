# Bug: MA-0576 Death Slaad — Spellcasting row renders ZERO spell chips (unmarked names)

## Overview
Death Slaad's Spellcasting action (monsters.json actions[2], index `death-slaad`) authors its spell list as plain text. The app's chip parser `extractSpellNamesFromSpellcasting` (src/components/encounter/MonsterCardHelpers.js:292-303) only recognizes spell names wrapped in `<strong>`/`<em>`, and skips any marked text ending in `:` (line 299). Death Slaad's description marks ONLY the tier headers (`<strong>At Will:</strong>`, `<strong>1/Day Each:</strong>`), so extraction yields `[]` → `SpellCastLinks` renders nothing (src/components/encounter/MonsterAction.jsx:62-63) → zero clickable spell affordances on a live joined card. `extractSpellcastingSpellUses` (MonsterCardHelpers.js:305-320) likewise binds 1/Day limits only to marked names → uses map `{}` → the five 1/Day spells are invisible AND ungated by construction. The row-level `spell_save_dc: 16` never renders a save-shell chip either (row named "Spellcasting" renders SpellCastLinks XOR ActionSaveRoll — MA-0532). No cast, save, damage, or 1/Day spend adjudication is reachable at all. Exact twin of MA-0421/MA-0524/MA-0532/MA-0552/MA-0558/MA-0564/MA-0572 class.

## Expected (manifest row + monsters.json)
Description (authored, monsters.json): "The slaad casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16):\n<strong>At Will:</strong> Detect Magic, Detect Thoughts, Invisibility (self only), Mage Hand, Major Image\n<strong>1/Day Each:</strong> Blight (level 8 version), Cloudkill (level 6 version), Fly, Plane Shift, Tongues"
Authored fields: `spell_save_dc: 16`, `spellcasting_ability: "Charisma"` (consistent with prose "spell save DC 16" and Charisma; row prose DC is numeric-backed, NOT MA-0237 class).
Expected per playbook §57/§89/§115: ten clickable `.mc-dice-link-spell` chips (5 At-Will ungated + 5 1/Day gated via `monsterSpellUses`, 2nd use refused with `automation blocked` log); save spells (Blight CON DC 16, 12d8 at level 8 per spells.json damage_at_slot_level['8'], half on success; Cloudkill CON DC 16, 6d8 level 6; Detect Thoughts WIS DC 16) prompt/resolve at DC 16.
All ten spells exist in public/data/spells.json (5e): Detect Magic, Detect Thoughts, Invisibility, Mage Hand, Major Image, Blight, Cloudkill, Fly, Plane Shift, Tongues — all True. Caster-fold check: "death-slaad" grep-zero in spells.json automation.variants (correct — straight EB monster, no fold expected).

## Actual
- Static: spell names PLAIN TEXT; only the two tier headers carry `<strong>`; both end in `:` → parser skips them; extraction = `[]`; uses map = `{}`.
- Live (test-campaign, EB join, header-verified): Death Slaad 1 card open (.mc-overlay), Spellcasting `.mc-action` container contains `[role=button], a, button, .mc-dice-link, .mc-dice-link-spell` count = 0; card-wide `.mc-dice-link-spell` = 0; sibling Chaos Blade "+9" chip renders (renderer healthy, row inert). Row innerText shows "(spell save DC 16)" prose but no numeric DC affordance. Campaign Log after card audit = 4 entries (encounter join + 3 initiative rolls), zero spell entries — no cast is even possible.
- Log: `/api/campaigns/test-campaign/change-data` has no monsterSpellUses keys (gating machinery never engaged — nothing to engage it).

## Steps to Reproduce
1. localhost:5173 → select test-campaign (verify header).
2. Encounters → Encounter Builder → search "Death Slaad" → check exact row → set Bandit qty 2 → Join Encounter (verify combatSummary has Death Slaad 1 + Bandit 1/2).
3. Initiative page → click Death Slaad 1 avatar → .mc-overlay opens with fresh stats (AC 18, HP 178).
4. Inspect Spellcasting row: zero chips, zero role=button affordances; card-wide .mc-dice-link-spell = 0 while Chaos Blade +9 chip present.

## Likely Location
DATA (public/data/monsters.json death-slaad actions[2].description) — markup gap, not code defect. Parser and gating consumers are live and byte-stable (MA-0421 archmage/lich fixed template). Fix = wrap each of the ten spell names in `<strong>` (or `<em>`), keeping the tier headers as-is, e.g. `<strong>At Will:</strong> <strong>Detect Magic</strong>, <strong>Detect Thoughts</strong>, <strong>Invisibility</strong> (self only), <strong>Mage Hand</strong>, <strong>Major Image</strong>` / `<strong>1/Day Each:</strong> <strong>Blight</strong> (level 8 version), <strong>Cloudkill</strong> (level 6 version), <strong>Fly</strong>, <strong>Plane Shift</strong>, <strong>Tongues</strong>`. Consumers to re-verify post-fix: MonsterCardHelpers.js extractSpellNamesFromSpellcasting/extractSpellcastingSpellUses → MonsterAction.jsx SpellCastLinks → MonsterCardModal cast routing + monsterSpellUses gate. (MonsterCardModal.jsx / saveProcessing.js / useLoggedDiceRollAttack.js unchanged; unreachable until chips exist.)

## Notes
- manifest row MA-0576 save_dc 16 == authored spell_save_dc 16 — DC numeric present, so NOT MA-0237 prose-DC gap; single defect = unmarked names (MA-0572 Death Knight Aspirant twin pattern: headers marked, names plain).
- Post-data-fix reminder (§21/§106): loaded tabs serve stale /data + combat-ui-viewingMonster snapshot — hard-reload + DELETE combat-ui-viewingMonster keys + re-join before re-verify.
- "level 8/level 6 version" upcast transport unproven this pass (chips unreachable); spells.json Blight level 4 base 8d8, damage_at_slot_level['8']="12d8"; Cloudkill level 5 base 5d8, ['6']="6d8" — re-verify dice on first live cast post-fix.
