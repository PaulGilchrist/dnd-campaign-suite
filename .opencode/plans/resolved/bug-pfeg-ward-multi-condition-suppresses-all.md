# PFEG charm ward on a multi-condition save row suppresses ALL conditions — `applyFailedSaveConditions` keys immunity off `applicable[0]` only

## Summary

The PFeg charm-immunity ward (Fey/Celestial/Fiend ancestry, e.g. War_Cleric's ward) is meant to block ONLY `charmed`/`frightened`. But `applyFailedSaveConditions` (src/hooks/combat/saveProcessing.js:1271) decides ward immunity off the FIRST condition of the row only — so a multi-condition save row whose first condition is charmed/frightened (e.g. a hag's Curse: "Charmed and Poisoned", `extractConditionsFromSaveEffect` order) suppresses the WHOLE row. RAW: `poisoned` should still land.

## Steps to reproduce

1. Code-locked face (already pinned): `src/hooks/combat/saveProcessing.pfeg-charm-immunity.test.js:140` — `it.fails('multi-condition row: ward blocks only charmed, poisoned still lands')`. Un-marking the `it.fails` shows the failure: with ward seeded and a failed save carrying `saveConditions:['charmed','poisoned']` from a Fiend attacker, `War_Cleric.activeConditions` never gains `poisoned`.
2. Live face (test-campaign): seed a ward-holder target and a monster save row whose failed save grants charmed+poisoned (Fiend attacker); resolve the failed save via the save prompt — observe zero conditions applied instead of `poisoned`.

## Expected behavior

Per the ward's own semantics (already correct for single-condition rows): the ward blocks only the charm-family condition(s); every non-warded condition in the row still applies and logs. For `['charmed','poisoned']` from a Fiend: no `charmed`, but `activeConditions` gains `poisoned` + a `condition applied` log row for it.

## Likely location

`applyFailedSaveConditions` in `src/hooks/combat/saveProcessing.js` (~:1271) — ward/immunity lookup keyed off `applicable[0]` instead of per-condition filtering.

## Suggested fix

Filter the condition list per-condition: drop warded conditions (charmed/frightened when the ward applies), keep and apply the rest; log the ward-blocked ones as before and the surviving ones normally. Flip the `it.fails` to a passing `it`. Check the sibling 2024 lane for the same shape.

## Resolution

**FIXED 2026-11-10.** Diagnosis confirmed exactly as filed — root cause in `applyFailedSaveConditions`
(`src/hooks/combat/saveProcessing.js`): the ward/immunity check called `playerIsImmuneToCondition`
with `conditionKey: applicable[0]` and, on a hit, `return false` for the WHOLE row. Note the check is
the SHARED immunity lookup, so the same first-only veto also silently suppressed sibling conditions for
RAW/static/feature/buff immunities (any row starting with a condition the target is immune to) — the fix
covers both families at once.

### Fix

Replaced the whole-row veto with a per-condition filter mirroring the sibling
`resolveAuraConditionSplit`/`splitAuraCoveredConditions` pattern already in the same function: each
condition in `applicable` is checked individually; immune ones are dropped (warded ones keep the exact
existing `logWardedConditionImmunity` `automation blocked` row, one per warded condition; non-ward
immunities stay silent, matching the pre-fix single-condition shape), survivors gather into `granted`
and apply + stamp meta + log `condition applied` exactly like a normal grant. `return false` (which
gates the MA-0639/MA-1351 fail-by-N margin rider) now fires only when EVERY condition was blocked.
Single-condition behavior byte-identical (both existing green pins in the test file passed unchanged).
Both call legs (`applyDamagelessSaveConditions` ~:1256 and the `applySaveDamage` damage leg ~:1711) and
both rulesets ride this one shared function; sibling lanes (`handleNpcSaveDamage.js:243`,
`handlePlainDamage.js:654`) already filtered per-condition — no other `applicable[0]` site exists.

### Files changed

- `src/hooks/combat/saveProcessing.js` — per-condition immunity filter in `applyFailedSaveConditions`
- `src/hooks/combat/saveProcessing.pfeg-charm-immunity.test.js` — `it.fails` → `it` (with blocked-row +
  applied-row assertions); NEW pins: mirrored order `['poisoned','charmed']` (immunity keyed per
  condition, not position) and mixed RAW immunity (poisoned-immune, non-warded target still gains
  charmed with no `automation blocked` row); mock extended to mirror the real static-immunities leg
- `src/services/automation/handlers/spells/{charmMonsterHandler,charmPersonHandler}.test.js`,
  `charmSpellUtils.aura-immunity.test.js` — stale cross-reference comments
  ("it.fails FIXME lane") → "green per-condition ward-filter lane"
- `docs/test-setup-playbook.md` — §2 scoped-PATCH array-field pitfall (in-place sharpen) + §4 AoE
  save-chip picker stacking law + canonical PFEG multi-condition live-rig recipe

### Verification

- **Red→green**: baseline file green with the 1 expected-fail; un-marking `it.fails` reproduced red
  (`activeConditions` undefined, expected `['poisoned']`); post-fix the file is 5/5 green.
- **Folder**: `npx vitest run src/hooks/combat` → 235 files / 1981 tests passed.
- **Full suite**: 3186 files / **34471 tests passed, 0 failed** — zero expected-fails remain app-wide.
- **Lint**: `npm run lint` zero warnings. `git diff --stat`: 6 files, +75/−29.
- **Live faces (test-campaign, GM tab, post-fix dev pair, campaign-locked)**:
  1. *Multi-condition Fiend row*: PFEG ward + −19 warding_bond dial seeded pre-select on War_Cleric;
     EB-joined **Lamia** (Fiend, `monsterType:'Fiend'` on the cs row); Corrupting Touch save chip →
     prompt carried `saveConditions:['charmed','cursed','poisoned']` (stronger than the filed 2-cond
     row — the "cursed for 1 hour" clause extracts as its own condition); failed save (DC 13, total 1)
     → `activeConditions: ['cursed','poisoned']` — **poisoned lands** (pre-fix: NOTHING), plus log rows
     `save_result` fail → damage `hp_change` → `automation blocked` "War_Cleric can't be Charmed by
     Lamia (Fiend) — Protection from Evil and Good." → `condition applied` "Cursed, Poisoned".
  2. *Single-condition charm ward byte-identical*: EB-joined **Succubus** (Fiend) Charm (DC 15 CHA)
     failed → exactly one new `automation blocked` row, zero conditions applied.
  3. *Humanoid still lands charmed*: EB-joined **Performer Maestro** (Humanoid) Beguiling Song (DC 15
     WIS, AoE picker) failed with the ward STILL active → `condition applied` "Charmed <- Performer
     Maestro", zero Maestro blocked rows.
- **Exit ritual**: tab closed → two-pass admin clears → change-data `{}` / log `[]` / overlays `[]`
  GET-verified; `git status --porcelain public/campaigns/` empty (npcs.json untouched — EB joins only);
  dev pair started by this run killed by PID (ports 80/5173 free); pre-existing opencode :80 client
  process left alone.

### Rules-data note

The bug text attributed "Charmed and Poisoned" to a hag; in `public/data/monsters.json` the owning row
is the **Lamia's Corrupting Touch** (Fiend) — an even better face (Fiend is a warded type AND the
canonical 2024 charm-dial monster the SP-094 suite already names). Green Hag has no such row here.

