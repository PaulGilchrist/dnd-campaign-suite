# Analysis Report — `src/` (2026-11-01)

**Scope:** 1,279 non-test `*.js|jsx` files (229,796 lines); ts/tsx: none. Tests, `dist/`, `build/`, `node_modules/` excluded from findings (used only to prove symbol usage).

**Method:** full import-graph walk (all relative specifiers resolved, incl. dynamic `import()`); word-boundary export-usage scan over all files; shingle-based clone detection (10-line normalized windows, comments/whitespace stripped) followed by exact common-run extraction; brace-depth + approximate cyclomatic-complexity (CC) measurement per function ≥120 lines.

**Freshness:** this replaces the prior edition of this report. Items it marked RESOLVED (savageAttacker twins, warlock `beguilingTwistHandler.js`, both deleted in `234d56073`) stay gone; `FearModal.jsx` has since been folded into the shared modal base. Everything below is verified against the current working tree.

---

## Duplication

Clone pairs are ranked by *exact* shared ≥10-line runs (normalized), which undercounts structurally-similar-but-reworded code; the shingle count is given as an upper signal.

1. **Sanctuary save fork (placement since unified, bodies still forked)** — `src/hooks/combat/handlers/handleSanctuarySave.js` (damage path) vs `src/hooks/combat/handlers/sanctuarySave.js` (attack path, moved from `combat/` on 2026-11-01).
   Shared runs: 21 exact lines; shingle 15. Both export `handleSanctuarySave` doing the same ritual — find `sanctuary` targetEffect → build `pendingSavePrompts` row (same 12-field literal, same "defaulting to 8" console.error fallback) → `sendSavePrompt`. They have **diverged signatures** (`(characterName, campaignName, context, logEntry)` vs `(attackerName, targetName, campaignName, setPopupHtml, logEntry)`) and each is imported by exactly one production caller: `useLoggedDiceRollDamage.js:12` and `useLoggedDiceRollAttack.js:27`. Both files now carry cross-reference NOTE comments; merging the bodies is a behavioral change, deferred.

2. **Maneuver execution twins** — `src/services/automation/handlers/class-fighter-rogue/executeActionManeuvers.js` vs `executeManeuver.js` (same folder): runs `:68-89 == :350-371`, `:103-119 == :233-249`, `:285-295 == :312-322`, `:332-345 == :309-322` (64 exact lines; shingle 26). The batch executor and the single executor each grew their own copy of the same per-maneuver rider logic.

3. **Revivify-adjacent handlers** — `src/services/automation/handlers/class-cleric-paladin/undyingSentinelHandler.js:27-38, :40-51, :57-67` == `src/services/automation/handlers/healing/revivificationHandler.js:25-36, :38-49, :55-65` (35 exact lines; shingle 33): same creature-target validation + revive plumbing, split by folder for no functional reason.

4. **Modal ↔ handler copy/logic bleed** — `src/components/char-sheet/modals/shared/TashasLaughterModal.jsx:110-123, :131-148` == `src/services/automation/handlers/spells/tashasLaughterHandler.js:56-69, :88-105` (32 exact lines; shingle 26). UI component re-implements the handler's effect-side logic (the shared `AreaEffectTargetModalBase` extraction stopped short for the remaining trio: `HypnoticPatternModal` 254 L, `TashasLaughterModal` 356 L, `CalmEmotionsModal` 362 L still share scaffolding via handlers/each other).

5. **Spell popup pair** — `src/components/char-sheet/CharActionSpellPopups.jsx:206-216, :221-243` == `src/components/char-sheet/char-spells/TargetSpellPopups.jsx:14-24, :34-56` (34 exact lines; shingle 16): same targeted-spell popup builder in two locations.

6. **Smaller confirmed clones** (each an exact ≥10-line run; candidates for a shared util, listed without prescription):
    - `modals/arcane/SavantModal.jsx:52-77` == `SignatureSpellsModal.jsx:46-71` (26 L)
    - `spells/animalFriendshipHandler.js` shares runs with 5 sibling charm/domination handlers (shingles 21/20/19/17/16/17) — no `charmSpellUtils` reuse on these legs despite the util existing
    - `spells/baneHandler.js:16-26, :34-44` == `blessHandler.js:16-26, :34-44` (22 L)
    - `modals/WarMagicCantripModal.jsx:16-31` == `WarMagicSpellModal.jsx:17-32` (16 L)
    - `cockatricePetrifyService.js:146-159` == `paralyzingBreathService.js:156-169` (14 L)
    - `hex-map/hooks/useZoomPan.js:134-147` == `map/hooks/useZoomPan.js:98-111` (14 L) — two same-named zoom/pan hooks, partially cloned (see Inconsistency #1)
    - `animateDeadHandler.js:49-59` == `createUndeadHandler.js:48-58` (11 L)
    - `giantAncestryDispatch.js:249-259` == `giantAncestryTraits.js:265-275` (11 L)

7. **Template duplication inside one file** — `src/components/encounter/MonsterCardHelpers.js:1581, :1633, :1685, plus the MA-0399 probe at :1952` — four `*IdentityRefusal` probes; the in-file comments literally say *"mirrors hellishRebukeIdentityRefusal"* (`:1627`, `:1731`, `:1952`). Same gate skeleton (target check → origin check → already-resolved stamp → attacker sanity → null) with per-feature predicates and message maps.

8. **Dual-ruleset core drift (by design, flagged for awareness)** — `src/services/rules/core/attackCalc.js:277-290, :338-361, :363-374` == `attackCalc2024.js:117-130, :151-174, :176-187` (50 exact lines; shingle 46); `spellCalc.js` vs `spellCalc2024.js` (shingle 13). The parallel-module pattern is mandated by the architecture, but these blocks are byte-identical today — a bug fixed in one will silently stay broken in the other.

---

## Hygiene Notes (informational — nothing to action)

**Orphan check (clean):** only `src/test/setup.js` (vitest config entry) and `src/components/common/__mocks__/ConcentrationPromptModalMocks.jsx` (auto-mock convention) are import-unreferenced — both legitimate. Production `console.log`: **zero** across all non-test files. `TODO/FIXME`: 9 hits, all in test files and all pointing at tracked ledger bugs (#799, PFE-G charm immunity, save-margin rider, ram-prone) — no stray production debt.

---

## Complexity

Function-level hotspots (brace-nesting depth = max `{}` depth incl. function frame; CC ≈ 1 + decision tokens, an approximation):

| Location | Lines | Nesting | CC≈ | Note |
|---|---|---|---|---|
| `src/App.jsx:296-786` `App` | 491 | 6 | 74 | Single component holding routing, SSE, campaign lifecycle, modals |
| `src/components/hex-map/hooks/useMapLoader.js:354-623` | 270 | 5 | 29 | One effect-dense loader; 8 test facets already probe its seams |
| `src/services/combat/automation/automationModifiers.js:1-250` `saveAbilities` | 250 | 5 | 28 | Flat but very long sequential pass |
| `src/components/char-sheet/DiceRollResult.handlers.js:3-246` `createDiceRollHandlers` | 244 | 5 | 48 | Factory returning many closures; high branch count |
| `src/hooks/wizard/useWizardFeatAbilityChoices.js:98-306` | 209 | **8** | 58 | Deepest nesting + high CC in the tree |
| `src/services/automation/handlers/healing/massHealUtils.js:44-243` `createMassHealHandler` | 200 | 5 | 37 | |
| `src/components/char-sheet/useCharActionsAutomation.js:276-472` `handleAutomationAction` | 197 | 7 | 21 | Deep dispatch chain |
| `src/components/initiative/useLootHandlers.js:54-267` | 214 | 7 | 20 | Deeply nested modal-confirm flows |
| `src/services/rules/core/maneuvers.js:10-176` `processManeuvers` | 167 | 7 | 48 | Long switch-style maneuver dispatch |
| `src/components/char-sheet/modals/HurlThroughHellModal.jsx:23-215` `handleConfirm` | 193 | 5 | 14 | Long but linear |

File-size hotspots (whole-file context, not single functions): `MonsterCardHelpers.js` 3,485 L · `MonsterCardModal.jsx` 2,944 L · `SaveAttackAoeModal.jsx` 2,060 L (component body at `:1444-1570` is only 127 L — most of the file is module-level helpers) · `saveProcessing.js` 1,746 L · `targetEffectDefinitions.js` 1,552 L (registry — long by design) · `handlePlainDamage.js` 1,272 L.

Dependency tangle signal: `App.jsx` and `MonsterCardHelpers.js` are the two widest-fan files; `handleSanctuarySave`’s fork (Duplication #1) sits on both the attack and damage roll paths, doubling the blast radius of any sanctuary fix.

---

## Inconsistency

1. **Two hook-location conventions with colliding names.** `src/hooks/{combat,management,wizard,ui,ui}/…` vs component-local `src/components/<name>/hooks/…`. Consequence: **two `useMapLoader.js`** (`hex-map/hooks/`, `map/hooks/`) and **two `useZoomPan.js`** (same pair, 14-L shared run) — a reader (or agent) resolving a bare hook name can hit the wrong file. Descriptive, not prescriptive: a naming or re-export convention would disambiguate.
2. **Filename-suffix drift.** Component conventions elsewhere are `PascalCase.jsx` folders/files; `CharActionModals.SecondaryModals.jsx` introduces a second capitalized segment, and `contextBuilder-sync.js` a kebab suffix, in an otherwise camelCase service directory.
3. **Half-finished extraction.** `AreaEffectTargetModalBase` exists, yet the three surviving area modals that import it still duplicate save-prompt legs against their handlers (Duplication #4).
4. **Identical blocks in the dual-ruleset twins** (Duplication #8) — the architecture mandates *separate* modules, but byte-identical stretches inside them mean fixes must be applied twice; worth a standing note for anyone touching `attackCalc*`.

---

## Prioritized Low-Risk Opportunities

Ranked by safety:

1. **Defer:** identity-refusal template extraction in `MonsterCardHelpers.js`, dual-ruleset dedup (#8), and the App.jsx decomposition — real smells, but every slice of them is a behavioral-refactor campaign, not a low-risk cleanup.

All higher-priority items were completed 2026-11-01: dead file + dead exports + test fixtures removed; sanctuary fork placement unified; Brutal Strike bonuses folded into `brutalStrikeGrants.js`; mass-heal pair into `massHealSpellFactory.js`; shake pair into `wakeOnDamageShake.js`. CharActions "27-L twin" proved a false positive (hook destructure vs return list).
