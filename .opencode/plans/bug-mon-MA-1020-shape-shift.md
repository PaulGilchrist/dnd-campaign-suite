# Bug MA-1020 — Imp "Shape-Shift" DEAD ROW — FAIL(b)

**Date:** 2026-09-23 · **Rig:** :5173 test-campaign, Imp 1 idx1 21/21 (untouched after test) · **Verdict: FAIL(b)** — zero affordance, zero effect, zero log.

## Disk row (verbatim, public/data/monsters.json → imp.actions[2])
> **Shape-Shift.** The imp shape-shifts to resemble a rat (Speed 20 ft.), a raven (20 ft., Fly 60 ft.), or a spider (20 ft., Climb 20 ft.), or it returns to its true form. Its game statistics are the same in each form, except for its Speed. Any equipment it is wearing or carrying isn't transformed.

Keys present: `name`, `description` ONLY. No `automation`, no `uses`, no `recharge`, no `attack_bonus`, no `save_dc` — confirmed.

## Live card row affordance (verbatim)
`<strong>Shape-Shift.</strong> <span>The imp <strong>shape-shifts</strong> …</span>` — measured in open stat modal: **0 buttons, 0 role="button", 0 mc-dice-link chips, 0 pointer-cursor children. NONE.**

## Zero-delta evidence
- Entire campaign log (500 entries): `shape.shift|rat|raven|spider` → **0 matches**. No shift transport ever fired.
- Imp 1 runtime combatant: `formName/shapechangeSource/polymorphSource/beastName` all null; maxHp 21 unchanged. (change-data/log stream hashes drift passively ~every 2s with no writes — ambient noise, not a delta; the 0-log grep is the pinned evidence.)
- Console: 0 errors.

## Gate/gap cites (twin of MA-1019 fingerprint)
- `src/components/encounter/MonsterAction.jsx:267` — `const isSpellcastingRow = /^spellcasting$/i.test(action.name || '')` — "Shape-Shift" ≠ "Spellcasting" → no SpellCastLinks.
- All other chip lanes require data the row lacks: attack chip (`attack_bonus != null`), save chip (`save_dc != null`), damage links (no dice formula in text), recharge/legendary/usage links (absent fields).
- Live seam: `SelfBuffLink` (`MonsterAction.jsx:224`) gated by `isMonsterSelfBuffRow` (`src/services/encounters/monsterSelfBuff.js:25`: `row?.automation?.type === 'monster_self_buff' && !!row.automation.effect`) — **unreachable** for this row's data shape (`automation` absent entirely).
- Nearest existing transports are spell-scoped, not row-scoped: shapechange/animal-shapes handled via `shapechangeSource`/`shapechangeForm` set by caster spells (`src/components/initiative/npcClickFormHandlers.js:154,226`); `shape_shift` in `src/services/combat/conditions/conditionEffectsInternal.js:127` is only a save-modifier context key. No monster-row form chooser or speed-mode toggle exists anywhere (`grep 'shape-?shift|polymorph|changeShape|form'` across src/services + MonsterCard*/CreatureCard*).

## Fix lane note
Same lane as MA-1019 inert-row remediation: author row automation (e.g. `{type:"monster_self_buff"}`-style form lane) or add a dedicated `monster_shape_shift` transport that swaps Speed modes per form (rat 20 / raven 20+fly60 / spider 20+climb20) on the combatant with a chooser + log entry, reusing `registerTargetEffect`/expiration pattern from `monsterSelfBuff.js`. Until wired, row stays advisory-only.

## Cleanup
No manifest edits, no git writes, no clears; Imp 1 stays 21/21 in initiative.
