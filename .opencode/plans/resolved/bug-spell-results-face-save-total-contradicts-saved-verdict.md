# Bug: Spell Results face prints a save total that contradicts its own "Saved" verdict (Burning Hands: "Saved … (rolled 10)" vs DC 17)

## Summary

The spell Results modal (`SaveAttackHealModal` / AoE twin) prints per-target rows like `Goblin 2: Saved — takes 12 Fire damage (rolled 10, halved)`. Per the pinned convention in `SaveAttackHealModal.saveFlows.test.jsx`, the parenthetical is the target's **save total** (`roll: 7, saveBonus: 3 → "rolled 10"`). Live-captured during the 2026-11-23 Magic Jar drill, the verdict ("Saved") and the applied math (damage 25 halved to 12, HP 200→188, matching the log `roll` row total 25) are mutually consistent — but the displayed save total **10** cannot produce a Saved outcome against the reported DC 17. Either the modal displays the wrong save total/bonus, or the DC is not what the log says, or the parenthetical switches meaning between faces. The face's own three numbers do not reconcile.

## Steps to reproduce

1. In `test-campaign` on localhost, run a spell attack with a DEX save-for-half effect against a monster — captured case: `AasimarTest` casts Burning Hands (7d6+3 radiant via Radiant Soul) on `Goblin 2` (fixture combat via the campaign's standing board or a fresh EB join).
2. On the target's save prompt, roll the save (or ride the drill's out-of-band lane); when the Results face mounts, capture its row text verbatim (the MutationObserver captures under `.opencode/sandbox-experiment/capture/` already contain three instances — files `mj-1795479997072-0-uaej.md`, `mj-1795480257074-0-xdvz.md`, `mj-1795480325075-0-75de.md`).
3. GET `/api/campaigns/test-campaign/log` — read the authoritative `roll` row for the same save (d20 + bonus vs DC) and the damage row (total 25, applied 12).
4. Compare: Results-face parenthetical vs the log's save total vs the DC vs the Saved/Failed verdict and applied halving.

## Expected behavior

The Results row's parenthetical must equal the log's authoritative save total, and the verdict + halving must be consistent with that total vs the DC (e.g. `rolled 17` for a total that meets DC 17 → `Saved`, half damage).

## Actual behavior

Captured row: `Goblin 2: Saved — takes 12 Fire damage (rolled 10, halved)` while the adjudication chain is reported at DC 17 (and the log's own save row is the ground truth for the roll+bonus). A save total of 10 against DC 17 is a FAILURE (full 25), yet the row says Saved and applied 12. The displayed number contradicts the outcome it annotates. Live-captured 2026-11-23 (Magic Jar sandbox drill, run captured to `.opencode/sandbox-experiment/`).

## Likely location

- `src/components/char-sheet/modals/shared/SaveAttackHealModal` (+ `SaveAttackAoeModal` twin) — the results-list row builder that emits `Saved — takes N <type> damage (rolled M, halved)`; verify what feeds `M`: the save total, the raw d20, or a stale/wrong-scope bonus.
- `SaveAttackHealModal.saveFlows.test.jsx` lines ~135/156/203 pin the save-total reading (`roll: 7 + saveBonus: 3 → "rolled 10"`) — check whether the live lane passes the same shape (AOE/monster-target path may differ from the pinned PC-path shape).
- Adjudication ground truth: the save pipeline / `roll` log row (`public/campaigns/test-campaign/data/campaign-log.json`) and the spell save DC derivation for the caster — confirm the real DC first; the drill's "DC 17" came from the captured prompt text, re-derive it from the log row.

## Suggested fix

Trace the value printed in `rolled M` through the monster-target AOE path (vs the pinned PC path) and fix whichever leg diverges: the parenthetical should render the SAME save total the engine adjudicated with. If the investigation instead shows the parenthetical is intentionally the RAW d20 (not total) on some faces, that ambiguity is the bug — make the copy unambiguous (`saved with 10` vs `rolled 10`) and pin BOTH faces (saved + failed) in the sibling tests.

## Severity

Cosmetic-adjacent-to-trust: the damage math, log rows, and HP application are correct; the Results face's annotation shows a number that, read as the save total, contradicts its own verdict — GMs adjudicate at the table from this face.

## Resolution

**FIXED 2026-11-23 (fix run).** Outcome: the bug is real on the monster/AOE Results face, but the bug file's diagnosis was a misreading — the defect is an AMBIGUOUS annotation, not a wrong value: the parenthetical never showed the save total anywhere.

### What was actually wrong (vs the guess)

- The captured face is `SaveAttackAoeModal` (the `Burning Hands — Results` `.sp-overlay` lane). Its `saveOutcomeRowText` fed `r.roll` = the **raw d20 save roll** (`computeNpcSave`: `saveRoll = raw1`, `success = saveRoll + saveBonus >= saveDc`), while the verdict and the halving adjudicate on the hidden TOTAL, and the log row records `saveRoll`/`saveBonus` separately. The damage math, log, and HP application were all correct; the face's number just could sit below the DC beside a "Saved" verdict (or at/above it beside "Failed" with a negative bonus). Live pre-fix repro (test-campaign, EB Goblin, DivinationWizard Burning Hands, `Math.random` pinned 0.82 → raw d20 17, dex +2, DC 19): face = `Goblin: Saved — takes 10 Fire damage (rolled 17, halved)` vs log `saveRoll:17, saveBonus:2, saveDc:19, saveResult:"success", finalDamage:10` — `17 < DC 19 yet Saved`, exactly the captured contradiction class.
- The "pinned convention = save total" premise was **false**: `SaveAttackHealModal` prints `r.rawDamage` (the DAMAGE roll) in the identical `(rolled N, halved)` sentence — its own failing-face pin (`saveFlows.test.jsx:157`: save total 6+3=9, face `rolled 10` — the mocked 4d6 damage) proves the parenthetical there is damage, and `roll:7 + bonus:3 → "rolled 10"` was a coincidence. That face is internally consistent (`10` halved `→ 5`) and was left unchanged. The same words meaning save-die in one twin and damage-die in the other is the family ambiguity the fix removes on the offending lane.
- The captured `Goblin 2: Saved … (rolled 10)` vs DC 17 was raw d20 10 plus the drill's re-stamped Magic-Jar body's save bonus (that fixture carried 200 HP, so a high save bonus is expected) — no engine misadjudication.
- Dual-ruleset check: both rulesets ride the SAME shared modals (no 2024 twin files); the equation copy is ruleset-neutral.

### The fix (established pattern, not invented)

Rows now print the app's standing adjudication equation `rolled R + B = T vs DC D` — the copy the `save_result` log rows (`npcSaveResultDescription`, "bonus shown even when 0") and `ClairvoyantCombatantModal`/`HurlThroughHellModal` already use, and the compact twin of `ElementalAttunementModal`'s own summary face:

- `src/components/char-sheet/modals/shared/AreaEffectSaveFlow.utils.js` — new shared `saveEquationText({roll, saveBonus, total}, saveDc)`.
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx` — all six annotation branches of `saveOutcomeRowText` now print the equation (both render sites thread `saveDc` through the existing opts object). Covers saved+halved, saved-no-damage, staged sleep/paralysis/petrify, plain fail, and failed-damage faces; soulstitch/dismissed rows keep their own short-circuit copy.
- `src/components/char-sheet/modals/ElementalAttunementModal.jsx` — the same-leg processing face (it printed bare raw d20 while its own summary face already printed the equation) now uses the shared helper.
- Repro face after fix: `Goblin 2: Saved — takes 10 Fire damage (rolled 17 + 2 = 19 vs DC 19, halved)` — reconciles exactly with the log (`saveRoll 17 + saveBonus 2 = 19 = DC 19`, `finalDamage 10`). Adjacent failed-face sanity: `Goblin 3: Failed — takes 17 Fire damage (rolled 12 + 2 = 14 vs DC 19)` vs log `saveRoll:12, saveBonus:2, saveResult:"failure", finalDamage:17` — full damage, consistent verdict.
- Pins updated with the behavior change (old raw-d20 faces retired): `overlay` (Goblin A row now `(rolled 1 + 2 = 3 vs DC 15)`), `soulstitch` (`(rolled 1 + -1 = 0 vs DC 17)`), `staged-paralysis` ×2 (`(rolled 2 + 2 = 4 vs DC 24)` / `(rolled 20 + 2 = 22 vs DC 13)`), `staged-petrify` (`(rolled 20 + 2 = 22 vs DC 15)`), `thunderclap-sphere` ×4.
- New regression pin: `SaveAttackAoeModal.results-face-equation.test.jsx` — locks BOTH faces at exactly the seams the bug file asked for: total EXACTLY meets DC (raw 15 + 2 = 17 vs DC 17 → Saved+halved equation; old `(rolled 15)` contradicted itself) and total FAILS BY 1 under a negative bonus (raw 17 − 1 = 16 vs DC 17 → Failed full damage; old `(rolled 17)` contradicted the mirror way), plus machine-truth pins proving only the display changed (rollback ledger `{roll:15,total:17}` and the `save-damage` log row keep the raw saveRoll + bonus).

### Verification

- Unit: new test 3/3 green → `src/components/char-sheet/modals` full folder **256 files / 2251 tests passed** → `npm run lint` zero warnings → full `npm run test:run`: **37653 passed / 4 failed** — all four failures in `server/services/ai/authoring/*` (`entitySchemas.name-law`, `entitySchemas`, `party`, `storyBible`), which validate the REAL test-campaign disk fixtures and have ZERO imports of the touched modules. They fail on sandbox-experiment residue written concurrently into `data/npcs.json` (md5 `903bb2c6…` vs baseline `db6666c1…`; an injected "Cap Drill Sergeant" row with an invalid `attitude` — its `notes` literally say "Sandbox-experiment custom NPC"). Pre-existing/environmental, NOT caused by this change; char aggregate pin `514ec55f…` held.
- Live: repro + post-fix re-ride on :5173 as captured above (both faces byte-reconciled with `/log` rows); closeout cleared the board and admin-cleared change-data (`{}`) + log (`[]`), overlays `[]`.

### Found nearby, NOT fixed (filed)

- `.opencode/plans/bug-aoe-condition-results-row-brace-literal-leak.md` — `AOEConditionModal.jsx:589-590` renders a literal `{r.saveBonus !== 0 ? ...}` into its save annotation (missing `$` in a template literal).
- `SaveAttackHealModal`'s `(rolled N)` remains the damage roll (self-consistent); renaming it would be copy churn outside this bug — fold into the AOEConditionModal tracker's family pass if the owner wants one equation everywhere.
