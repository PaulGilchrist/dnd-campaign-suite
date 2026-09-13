# BUG MA-0012 — Aberrant Cultist · Spellcasting (FAIL, flavor b: zero affordance)

**Row:** MA-0012 · monster "Aberrant Cultist" · actionType spellcasting
**Verdict:** FAIL — zero cast path for both named spells (Detect Thoughts, Minor Illusion). Worse inertness than MA-0005.

## Data drift (public/data/monsters.json, aberrant-cultist)
- Spellcasting entry is description-only: **NO `save_dc`, NO `save_type`, NO damage fields**, despite description text "(spell save DC 15)".
- Spells "Detect Thoughts, Minor Illusion" are inline `<em>` description text — no structured `spells` field.

## Rendering gate (src/components/encounter/MonsterAction.jsx)
- `ActionSaveRoll` returns `null` when `action.save_dc == null` (line 31) → no DC-15 link.
- `ActionDamageLinks` returns `null` (no `actionDamageFormula` extractable from description, no `damage_dice_secondary`) (lines 11–13).
- No `attack_bonus` → no attack link (line 64 gate).
- Net: row renders as pure static text. MV-6 affordance rule shape.

## Live probe (localhost:5173, test-campaign, 2026-09-13)
- EB "Aberrant Cultist" → Join Encounter; joined cs at 137 hp; PC target AasimarTest armed via cultist card `target-select`.
- Avatar click opened `.mc-overlay`. Spellcasting row DOM:
  `innerHTML` = `<strong>Spellcasting.</strong> <span>…(spell save DC 15):<br><strong>At Will:</strong> <em>Detect Thoughts</em>, <em>Minor Illusion</em></span>`
  — `.mc-dice-link`: **0**; buttons/`[role=button]`/links: **0**. Spell names inert `<em>` text.
- No block link existed, so popup-DC probe moot (contrast MA-0005 which had a generic DC link with inert effect).
- Forced `el.click()` ×2 on row + both `<em>` spell names + `<strong>` labels: **zero overlays** (`.sp-overlay,.popup-overlay,.sp-modal,.popup` width>0 = none), **zero new log entries** (log contains only `encounter/joined` + `roll/initiative` written at join timestamp), **zero change-data deltas** beyond `combat-ui-viewingMonster*` avatar-open keys; `pendingSavePrompts` null, `lastAttack` null, cultist HP 137 unchanged, targetEffects null on both cultist and armed PC.

## Consumers
- `grep detect_thoughts|minor_illusion` in src/: zero monster-card/monster-cast consumers (only `getPreSelectedSpells.js` PC preselect list + `restRules-constants.js` free-cast key). No chooser, no handler, no cast path for a monster casting either spell.
- Ungating (At Will) probe moot: row is fully inert.

## Bucket
- MA-0005: DC link present, effect inert → FAIL.
- MA-0012: **zero affordance** for both named spells + DC drift (description says 15, `save_dc` unauthored so even the generic block link cannot render) → FAIL (lower severity of interactivity than MA-0005: nothing is clickable at all).

## Fix direction (informational)
Author `save_dc: 15`, `save_type: "Wisdom"` on the row (restores generic block link parity with MA-0005) and/or a structured `spells` list + a monster spell chooser consumer if per-spell casting is desired.

## Cleanup
Admin clear change-data + log executed post-probe; browser closed. No manifest/playbook edits.
