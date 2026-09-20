# MA-0614 — Doppelganger "Read Thoughts" — FAIL(a) inert save row

## Row
`public/data/monsters.json` Doppelganger `actions[2]`:
```json
{
  "name": "Read Thoughts",
  "description": "The doppelganger casts <em>Detect Thoughts</em>, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 12).",
  "spell_save_dc": 12,
  "spellcasting_ability": "Charisma"
}
```
Keys verbatim: `spell_save_dc` 12 present; `save_dc`, `save_type`, `save_effect` ABSENT.

## Defect
Generic save-shell chip is armed ONLY by numeric `save_dc`
(`MonsterAction.jsx:89` `if (action.save_dc == null) return null;` and `:194`
`actionHasSave = action.save_dc != null`). `spell_save_dc` has ZERO render/save
consumers for monster rows — sole read app-wide is the spell-origin cosmetic
marker `isSpellOriginAction` (`MonsterCardModal.jsx:820`). `buildSaveOptions`
maps only `action?.save_dc` (`:797`). §89 precedent: "spell_save_dc alone never
reaches buildAbilitySaveRollContext". Playbook §127 applies to rows with numeric
`save_dc`, not `spell_save_dc`.

## Live proof (test-campaign, :5173, 2026-09-20)
- EB join: cs = Doppelganger 1 (hp 52) + Bandit 1; Bandit staged 999 via
  full `/combatSummary {value}` POST (200).
- Doppelganger card, "Read Thoughts" row: 0 `.mc-dice-link` chips
  (`rtChips: []`) — no DC 12 save-shell.
- 2× real mouse clicks on row + popup flush: log delta 0, `lastAttack:null`,
  no `saveResult-*` key, no victim `roll save`, no condition, no damage,
  no ability_use. Row fully inert.
- Grep: no detect-thoughts/telepathy monster-path consumer; hits are
  PC-spell/validation/tests only (`monsterAbilityUses.js:7` comment +
  `saveProcessing.js:861` GM-enforced advisory note).

## Expected vs RAW
Expected affordance: DC 12 save-shell chip adjudicating vs Bandit (mod +0,
DC 12 = honest save). RAW nuance advisory: Detect Thoughts save type is
Intelligence and non-humanoids auto-succeed — row never authors save_type,
but description doesn't name one either (no drift claim); even generic DC 12
chip would be the honest observable ceiling. Telepathy/sensing clauses stay
advisory (§70 zero consumer).

## Fix (DATA, one-field family)
Add `"save_dc": 12` to the row (optionally `"save_type": "intelligence"` for
RAW fidelity). Chip then renders via existing ActionSaveRoll seam; no code fix.
