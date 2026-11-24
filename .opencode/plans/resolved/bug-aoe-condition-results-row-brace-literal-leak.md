# Bug: AOEConditionModal results row prints a raw JS brace-literal into the save annotation (missing `$` in template literal)

## Summary

`src/components/char-sheet/modals/shared/AOEConditionModal.jsx:589-590` builds the per-target
Results rows with `rolled ${r.roll ?? 0}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = ${r.total}`
— but inside a template literal, `{...}` is NOT interpolation. Both faces render the literal
source text: `Saved — unaffected (rolled 15{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = 17)`.
The annotation is unreadable garbage on every save row this modal shows (Condition-AoE family:
Hypnotic Pattern / Fear / etc. picker + processing lane).

## Steps to reproduce

1. Code-level (confirmed by read): any Results/processing row through `AOEConditionModal.jsx:588-590`.
2. Live: cast a condition-AoE save spell (e.g. Hypnotic Pattern) affecting ≥1 creature, read the
   per-target row — the parenthetical contains the verbatim `{r.saveBonus !== 0 ? ...}` source text.

## Expected behavior

`(rolled 15 + 2 = 17 vs DC 17)` — the same self-reconciling equation `saveEquationText`
(`AreaEffectSaveFlow.utils.js`, shipped 2026-11 for `bug-spell-results-face-save-total-contradicts-saved-verdict`)
renders on the SaveAttackAoeModal / ElementalAttunementModal result faces.

## Actual behavior

`(rolled 15{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = 17)` — raw template source leaks into
the user-visible row.

## Likely location

- `src/components/char-sheet/modals/shared/AOEConditionModal.jsx:589-590` — the two row-builder
  branches. The author clearly INTENDED the bonus term (it even spells the sign logic) but wrote
  `{...}` instead of `${...}` inside backticks.

## Suggested fix

Replace both branches' hand-rolled annotation with the shared
`saveEquationText(r, saveDc)` from `./AreaEffectSaveFlow.utils.js` (already imported pattern in
SaveAttackAoeModal / ElementalAttunementModal), and pin both faces (saved + failed) in a
co-located `AOEConditionModal.results-face.test.jsx` — no existing test pins this row copy
(grep-confirmed 2026-11-23).

## Severity

Cosmetic (broken display copy on a shared adjudication face); damage/save math in the log rows is
correct. Found incidentally during the fix of
`bug-spell-results-face-save-total-contradicts-saved-verdict` (2026-11-23) — filed, NOT fixed, in that run's scope.

## Resolution

FIX: FIXED (2026-11-23, fix run).

**Actual cause vs guess** — the diagnosis was exact. `AOEConditionModal.jsx`
renderBody (the `AreaEffectTargetModalBase` overlay-lane processing/results
face) built both verdict branches inside template literals with
`(rolled ${r.roll ?? 0}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = ${r.total})`
— the `{...}` term missing its `$`, so the raw JS source rendered verbatim.
Grep census: this was the ONLY brace-literal leak app-wide — the sibling
`saveBonus !== 0` sites in `SetConditionModal.jsx:253`,
`BlindnessDeafnessModal.jsx:257`, `AreaEffectTargetModalBase.utils.jsx:58` are
genuine JSX interpolations (work), and `AOEConditionModal.subcomponents.jsx`
ResultsSummaryModal was a string-concat twin (works, but hand-rolled and
printed a DC-less equation that could not be reconciled against the announced
DC — same non-self-reconciling family this row copy was fixed for in
SaveAttackAoeModal). No dual-ruleset twin exists (`aoeCondition` save_path
routes both rulesets through this one modal; HypnoticPattern/CalmEmotions have
their own modals whose rows ride `AreaEffectTargetModalBase.utils.jsx` —
untouched, honest). Log rows (`buildSaveResultEntry`, `resolveNpcTarget`
descriptions) interpolate correctly and stay byte-unchanged (machine truth).

**Live pre-fix witness (test-campaign, :5173, Entangle DC 17 cast, d20 pinned
17 via `Math.random=()=>0.82`):**
`Goblin BraceRig: Failed — restrained! (rolled 17{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = 12)`
`Orc BraceRig: Saved — unaffected (rolled 17{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = 22)`
Riding that required a rig discovery: the overlay lane is **live-unreachable**
because `savePath.js:180` misses `await getCombatContext(...)` — witness was
captured with a temporary byte-restored `await` shim (reverted, md5-verified).
Filed separately: `bug-spellcast-overlay-lane-missing-await-getcombatcontext.md`.

**Fix (pattern copied, not invented — mirrors `SaveAttackAoeModal.jsx:1265-1281`):**
- `AOEConditionModal.jsx` — both renderBody branches now call
  `saveEquationText(r, saveDc)` from `./AreaEffectSaveFlow.utils.js` (import
  extended alongside `dismissedNoEffectResult`).
- `AOEConditionModal.subcomponents.jsx` — `ResultsSummaryModal` takes `saveDc`
  (sole caller threads it; no compat default per no-legacy policy) and renders
  the same `saveEquationText` copy on both verdict branches; dismissed branch
  unchanged.
- New `AOEConditionModal.results-face.test.jsx` — pins BOTH faces (overlay-lane
  renderBody via the contract-stubbed base harness; selection-lane
  `Save Results` modal) with exact equations `Saved — unaffected (rolled 17 + 5
  = 22 vs DC 13)` / `Failed — Restrained! (rolled 17 + -5 = 12 vs DC 13)`, a
  not-to-contain pin on the leaked source text, and a machine-truth pin that the
  `save_result` log description keeps its own bytes.

**Verification:**
- Live after-fix, same rig: overlay-lane rows `Goblin BraceRig: Failed —
  restrained! (rolled 17 + -5 = 12 vs DC 17)` / `Orc BraceRig: Saved —
  unaffected (rolled 17 + 5 = 22 vs DC 17)` — reconcile byte-for-byte with the
  `save_result` log rows (`… DC 17, rolled 17 + -5 = 12` / `… rolled 17 + 5 =
  22`); adjacent selection-lane `Save Results` face shows identical copy.
- New test 3/3 green; `src/components/char-sheet/modals`(+`/shared`) 258 files
  / 2259 tests green (existing `Saved — unaffected` regex pins ride unchanged —
  prefix preserved); `npm run lint` zero warnings.
- Closeout: temp shim + WSD file surgery restored byte-exact (roster aggregate
  pin `514ec55f…` held), overlays cleared, admin clear-change-data + clear-log
  (board gone with the store), `cd {}` / `log []` / `overlays []` verified.
