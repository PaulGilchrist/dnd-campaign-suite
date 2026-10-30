# Overlay-targeted AoE casts never activate the overlay-aware picker — dead gate `playerStats.targetName` (zero producers)

## Summary

Targeting a spell overlay via the Initiative card's `─── Overlays ───` target option arms the caster's
`combatSummary` target with `overlay-<id>` (server-verified), but casting an area spell (tested: Fireball,
sheet spell lane) still opens the fully-generic manual creature picker: nothing is auto-selected from the
overlay hit-test, no distance badges render, and the overlay geometry constrains nothing. The overlay-aware
picker branch (`AreaEffectTargetModalBase`) is **unreachable dead code**: its gate reads
`playerStats.targetName`, a field with **zero write sites in the entire product**, and the fallback picker's
own overlay auto-select effect is starved because `SaveAttackAoeModal` omits the three props it needs.

## Steps to reproduce

1. In test-campaign, open the Battle Arena indoor map editor; click `Spell` (toolbar `button[aria-label="Spell"]`),
   select shape **Cone**, and click-drag on the map to place a cone whose geometry contains a map token
   (verified rig: apex grid (14,9), angle 0, distance 60ft → AberrantSorcerer token @(15,9) is inside,
   FeyRanger @(9,8) outside). Leave the overlay server-persisted (`GET /spell-overlay?campaign=test-campaign`).
2. Go to Initiative. On the DivinationWizard's creature card, set the target select
   (`[data-testid="target-select"]`) to the `Sphere/Cone (…ft)` option under `─── Overlays ───`.
   Verify server truth: `GET /api/campaigns/test-campaign/combatSummary` shows
   `creatures[].targetName = "overlay-<id>"` for DivinationWizard. (Active map is battle-arena;
   `change-data.__map__.activeMapName` is set.)
3. Open DivinationWizard's sheet; click the `Fireball` row → `Cast Spell`; dismiss the Soulstitch chooser
   (Cancel) — the Fireball target picker opens.
4. Observe the picker: it lists ALL 12 roster creatures, **nothing is pre-selected** despite the armed overlay
   whose hit-test resolves to AberrantSorcerer, and the confirm button reads `Fireball (0)` + `Skip`
   (the generic `CreatureSelectionModal` chrome) instead of the overlay-aware base (`(N targets)` + `Cancel`).
5. Control comparison: the single-target spell popups (`CreatureTargetPopups` / `GreaterRestorationHost`)
   DO receive `campaignName`/`attackerName`/`rangeFt` and their badge/auto-select effect lane is wired —
   the AoE modals' call sites simply never pass them.

## Expected behavior

With the caster overlay-targeted and a live overlay + active map, the area-spell picker should take the
overlay-aware branch (`isOverlayTargeted && activeOverlay` → `AreaEffectTargetModalBase`) and/or at minimum
auto-select the creatures inside the overlay via `CreatureSelectionModal`'s own overlay effect
(`getCurrentOverlayTarget` → `getCreaturesInsideOverlay`), as the code clearly intends.

## Actual behavior

The generic manual picker renders with zero auto-selection — arming the overlay produces **no observable
delta** in the AoE cast flow (two independent live casts reproduced; damage only ever landed on creatures
selected manually, and a creature OUTSIDE the cone was selectable with no warning). No console errors, no
toast, no refusal — silently inert.

## Likely location

Root cause 1 — dead gate (confident, grep-proven):
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx:1864`
  `const isOverlayTargeted = playerStats.targetName?.startsWith('overlay-')`
  — same pattern in `CalmEmotionsModal.jsx:109`, `HypnoticPatternModal.jsx:200`, `AOEConditionModal.jsx:472`.
  `playerStats.targetName` has **4 read sites and 0 write sites** product-wide (grep
  `playerStats.targetName *=` → nothing; no `setRuntimeValue(..., 'targetName', ...)`; payload builders
  pass the raw sheet playerStats — both `spellCastService/execution/savePath.js::handleAoE` (:182 resolves
  `activeOverlay` from **combatSummary**) and `automation/handlers/combat/saveAttackHandler.js::buildAoeModal`
  (:278 resolves from cs via `getAttackerTargetName`) compute the right value locally but never thread it
  into the payload's `playerStats`/gate).
- Because the gate is false, the resolved `activeOverlay` payload has **zero live consumers** in these four modals.

Root cause 2 — starved fallback (confident):
- `SaveAttackAoeModal.jsx` generic branch renders `<CreatureSelectionModal …>` WITHOUT `campaignName`,
  `attackerName`, `rangeFt`; `CreatureSelectionModal.jsx:31` effect early-returns
  (`if (!campaignName || !attackerName || targets.length === 0) return`), so overlay auto-select +
  distance badges never fire in the AoE lane. Working reference: `char-spells/CreatureTargetPopups.jsx:25-27`
  passes all three.

## Suggested fix

In both payload builders (`handleAoE`, `buildAoeModal`) the attacker's cs target is ALREADY resolved
(`attackerTargetName`). Thread it: either add `isOverlayTargeted: !!activeOverlay` to the payload and change
the four gates to read the payload, or spread `playerStats={{ ...playerStats, targetName: attackerTargetName }}`
into the payload. Independently, pass `campaignName={campaignName} attackerName={playerStats.name}
rangeFt={range}` to the fallback `<CreatureSelectionModal>` in SaveAttackAoeModal (and siblings) so the
auto-select/badge effect works even when the base branch isn't taken. Add a vitest pin: gate true when
cs target is `overlay-<id>` and the overlay exists.

## Severity

Broken feature — the Initiative overlay-target UI exists specifically to automate AoE targeting and is
inert for every modal consumer; GMs get silent manual rework instead of hit-testing (no feedback that
the arm was ignored).

## Summary (fix)

Overlay-targeted AoE casts now auto-select the creatures inside the armed overlay: the fallback
`CreatureSelectionModal` mount in the AoE/condition/hypnotic pickers receives the three props its
overlay hit-test effect needs (`campaignName`, `attackerName`, `rangeFt`), mirroring the working
single-target `CreatureTargetPopups` lane. The dead `playerStats.targetName` gate was intentionally
left closed — opening it would route the cast into `AreaEffectTargetModalBase`, which performs no
spell-overlay hit-testing (its `activeOverlay` is inert at that mount: `mapData={null}`,
`attackerPos={null}`), so the picker chrome would change but nothing would auto-select.

## Resolution

**Live-repro (before fix, test-campaign):** placed the verified cone (apex grid (14,9), angle 0,
distance 60ft → contains AberrantSorcerer @(15,9), excludes FeyRanger @(9,8)); armed
DivinationWizard via Initiative `─── Overlays ───` (server truth:
`cs.creatures[].targetName = "overlay-4bc264f6-…"`); Fireball → Cast Spell → Soulstitch Cancel →
picker showed 13 rows, **0 pre-selected**, `Fireball (0)` + `Skip`, zero badges — exactly the
reported behavior. Confirmed both filed root causes in code.

**What was actually wrong (root-cause adjudication):**
- Root cause 2 (starved fallback) is the real bug and the correct fix site.
  `CreatureSelectionModal.jsx:32-48` already resolves the attacker's armed cs target **itself**
  (`getCurrentOverlayTarget(campaignName, attackerName)` → `getCreaturesInsideOverlay` → pre-select +
  `getTargetMapStatuses` badges), and the working reference `char-spells/CreatureTargetPopups.jsx:25-27`
  wires exactly these three props. The AoE call sites simply omitted them.
- Root cause 1 (dead gate) — the suggested "thread `attackerTargetName` and open the gate" fix was
  verified against the real code and **rejected**: `SaveAttackAoeModal`'s base branch mounts
  `AreaEffectTargetModalBase` with `mapData={null}`/`attackerPos={null}`, and the base does NOT consume
  `activeOverlay` (its shape/hit-test path is `mapData`+`attackerPos`-driven) — flipping the gate would
  swap picker chrome (`(N targets)`+`Cancel`) with still zero auto-selection. Additionally the gate-true
  branches in `HypnoticPatternModal`/`CalmEmotionsModal` render an EMPTY comment-only Fragment, and
  those modals' producers hardcode `activeOverlay: null`, so opening their gates would blank the modal.
  The gate stays as-is (unit-test-driven prop lane, pinned by `SaveAttackAoeModal.overlay.test.jsx`),
  unreachable from the product builders as before.

**Files changed:**
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx` — fallback `<CreatureSelectionModal>`
  now gets `campaignName`/`attackerName={playerStats.name}`/`rangeFt={range}` (fixes Fireball + every
  `saveAttackAoe` producer: savePath.js 2024 lane, saveAttackHandler.js 5e lane, freezingSphereHandler).
- `src/components/char-sheet/modals/shared/AOEConditionModal.jsx` — same three props on its fallback picker.
- `src/components/char-sheet/modals/shared/HypnoticPatternModal.jsx` — `campaignName`/`attackerName` on its
  fallback picker (no `range` prop exists on this payload; distance status degrades to in-range, auto-select unaffected).
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.overlay-auto-select.test.jsx` — NEW regression pin.
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.creature-selection.test.jsx` — header comment
  updated (the "never passes campaignName/attackerName" note is superseded; lookups resolve empty there so the
  lane still renders deterministically — the file's 4 tests are unchanged and green).

**Verification:**
- Live re-run of the exact repro (same cone, same arm, reload for HMR): picker auto-selected
  `AberrantSorcerer` (inside), left FeyRanger + all 11 others unchecked, confirm button enabled
  `Fireball (1)`; untargeted control cast (target disarmed via Initiative select, server-verified
  `targetName` cleared) opened the picker with nothing auto-selected (`Fireball (0)` disabled + `Skip`);
  single-target popup lane (Fire Bolt) unchanged; zero console errors/warnings.
- Distance badges: correct by design in the rig — `getTargetMapStatuses` returns null when the attacker
  has no map token (DivinationWizard is not placed on battle-arena), so no badges rendered; badge
  rendering + `rangeFt` threading are pinned by the new vitest lane instead.
- Tests: `npx vitest run src/components/char-sheet/modals/shared` → 84 files / 512 passed;
  `npx vitest run char-spells + spellCastService/execution + handlers/combat` → 142 files / 1490 passed.
- `npm run lint` → clean (zero warnings).
- Teardown: overlays `{"action":"clear"}` → `GET /spell-overlay` `{"overlays":[]}`; Admin clear-change-data +
  clear-log from closed-tab quiet → `change-data {}`, `log []`, `combatSummary null` GET-verified.
