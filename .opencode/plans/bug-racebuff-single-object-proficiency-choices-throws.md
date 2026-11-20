# bug: raceBuffService 5e lane throws on single-object `proficiency_choices`

**Filed:** 2026-11-19 (e2e-improve run, from dev-pair log + data census; NOT yet fixed)
**Severity:** crashes the rules lane during character validate/build — unhandled rejection.

## Face (live witness)

Dev-pair log ~20:32 during a 5e wizard-walk improve ride (pair log tail, shared pair):

```
[Unhandled rejection] TypeError: trait.proficiency_choices.forEach is not a function
    at add5eTraitProficiencies (src/services/character/raceBuffService.js:184)
    at computeRaceBuffs
    at validateAbilityTotals (src/config/utils.js:109)
```

Item 3's implementer independently observed the same TypeError once during a
step-skipping wizard walk (reported "non-reproducing" — the census below shows
it is data-deterministic: it fires whenever the raced trait with the bad shape
is processed).

## Root cause (code-confirmed, census below)

Two shape expectations exist in the same file:

- **2024 lane** `addChoiceOptions2024` (`raceBuffService.js:221`) treats
  `trait.proficiency_choices` as a SINGLE OBJECT `{choose, from}` — correct for
  `public/data/2024/races.json` (Elf Keen Senses, Human Skillful, Human
  Versatile are all single-object; those rows are INTENDED shape for that lane).
- **5e lane** `add5eTraitProficiencies` (`raceBuffService.js:176-192`) assumes
  an ARRAY: `trait.proficiency_choices.forEach(pc => …)` — but two rows in
  `public/data/races.json` are single objects, so `.forEach` throws.

## Disk census (2026-11-19, node scan of both race files)

Non-array `proficiency_choices` in **5e** `public/data/races.json` (crash set):

| # | Race | Trait | Path | Value shape |
|---|---|---|---|---|
| 1 | Dwarf | Tool Proficiency | `[1].traits[3]` | `{choose:1, from:["Smith's Tools","Brewer's Supplies","Mason's Tools"]}` |
| 2 | Half-Elf | Skill Versatility | `[5].traits[2]` | `{choose:2, from:[18 skills]}` |

Non-array in **2024** `public/data/2024/races.json` (by-design for that lane — do NOT "migrate" without checking `addChoiceOptions2024`): Elf Keen Senses, Human Skillful, Human Versatile.

## Repro

5e character build/select a Dwarf or Half-Elf (any flow reaching
`computeRaceBuffs` → `validateAbilityTotals`) → unhandled TypeError; race buffs
for that trait are lost even if the caller survives the rejection.

## Fix options (owner/e2e-fix-bugs decision)

(a) Normalize the 5e lane: `const pcs = Array.isArray(pc) ? pc : [pc]` — NO:
  no-legacy dual-shape branch is forbidden by the no-legacy policy UNLESS one
  canonical shape is chosen for the 5e file.
(b) Migrate the two 5e rows to arrays (keep ONE canonical 5e data shape =
  array, matching `add5eTraitProficiencies`), adjust nothing else — likely the
  minimal policy-clean fix; verify no other consumer reads 5e
  `proficiency_choices` (grep consumers before committing).
(c) Unify both rulesets on one shape + one lane — bigger pass.

Also check test fixtures pinning the object shape for the 5e lane.

## Notes

- Reproduce cheaply in vitest: call `computeRaceBuffs` (or `applyRaceBuffs`)
  against the real `public/data/races.json` Dwarf/Half-Elf rows.
- `docs/app-exploration.md` backlog: no bullet added — bugs live HERE per the
  ownership law (bugs take priority over improvements).
