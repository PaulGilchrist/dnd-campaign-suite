# AoE save-attack lane: successful save by an Evasion holder pays half damage (evasion fold starved)

## Summary
Casting Burning Hands (DEX save AoE) from the character sheet with an overlay armed resolves the target's saving throw with the Evasion doctrine declared on the prompt ("No damage on success, half damage on failure"), the save succeeds, and the Results face + real HP commit still charge HALF damage. The CLA-124/125 evasion fold never fires on this live lane.

## Steps to reproduce
1. In `test-campaign`, open Initiative; quick-spawn a Goblin (`+ Monster` → `.qms-search` "Goblin" → row select → `.qms-spawn-btn`).
2. Activate `battle-arena` (Maps → Activate) and open the map view; arm the Spell wand (`[aria-label="Spell"]`), keep Sphere / 20 ft, click the board to place (overlay landed at (10,10)). Cancel spell mode.
3. Back on Initiative, set the DivinationWizard card's target select to the `overlay-<id>` option (`Sphere (20ft)`).
4. Open the DivinationWizard sheet, press `Burning Hands` → `Cast Spell` (level 1) → Cancel the Soulstitch chooser.
5. The creature picker opens with the overlay auto-preselect (FeyRanger — the only token holder inside the sphere at (9,8) on battle-arena). Confirm (`Burning Hands (1)`).
6. Skip the Leading Evasion chooser; on FeyRanger's "Saving Throw Required" prompt press `Roll Save`, then `Done`.

## Expected behavior
FeyRanger (2024 Ranger lv17 — Evasion derived live; the prompt itself prints "Evasion: No damage on success, half damage on failure") who SAVES (rolled 13 + 8 = 21 vs DC 19) takes ZERO damage; Results row should read "Saved — takes 0 … (Evasion)".

## Actual behavior
- Save prompt face honestly showed `SAVE SUCCESS — Total: 21 vs DC 19 — d20 (13) + 8` and the Evasion note.
- Results face: `.abjure-result-success` row `FeyRanger: Saved — takes 4 Fire damage (rolled 13 + 8 = 21 vs DC 19, halved)`.
- Disk truth: `hp_change` row `FeyRanger takes 4 damage (85/89 HP)`; damage roll row `9 (3d6 + 5 [Empowered Evocation]) Fire → 4 final`. The prompt's own `save_result` row even reads "succeeded DEX save (DC 19, rolled 13 +8 = 21 — full success)" — annotation, verdict and payment contradict each other.

## Likely location
Confident on the data-starvation leg, guessing on the fallback flag.
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx:1678` derives the adjudication roster as `const characters = combatSummary.creatures.filter(c => c.type === 'player')`. Live census (2026-11-24): all 15 combatSummary player rows are minimal stubs (`name,type,currentHp,maxHp,initiative,targetName,concentration`) — ZERO carry `computedStats`.
- `src/services/rules/combat/evasionUtils.js` (header comment) explicitly names this CLA-119 starvation: cs stubs "never contain computedStats, so the fold was inert"; the module's remedy is full PlayerStats + preferring `detail.evasionActive` from the prompt roller. But `adjudicatePromptEvasion` (SaveAttackAoeModal.jsx:474-475) is called with the starved `characters`, and `detail.evasionActive` evidently does not reach it on this lane (the roller clearly COMPUTED evasion — the prompt note renders it — so the flag is lost between roller and Done-commit).
- Unit pins (`SaveAttackAoeModal.cla124-evasion.test.jsx`) feed full stats — the same mock-mask pattern the 2026-11-23 `getCombatContext` fixes just rooted out elsewhere.

## Suggested fix
First: trace the Done-commit path from SavePromptModal's result detail into `adjudicatePromptEvasion` and confirm whether `detail.evasionActive` is stamped by the roller (compare `useLoggedDiceRollEventHandlers.determineEvasion` convention cited in evasionUtils). Either propagate `evasionActive` into the result detail (cheap, matches "detail.evasionActive is preferred when present"), or thread the REAL roster (rulesFactory getPlayerStats / characters store) into `characters` at SaveAttackAoeModal.jsx:1678 instead of cs stubs. Re-ride the exact steps above; expect `→ 0 final` + `takes 0 Fire damage … (Evasion)` and an `evasion` rollType ledger row.

## Severity
Data integrity risk — every Evasion/Circle-of-Power holder silently over-pays damage on sheet-cast save AoEs; the UI actively promises the zero and then contradicts it.

## Resolution (2026-11-24 fix-run: FIX: DISPROVED — adjudication correct; the premise was a display-annotation artifact)

No source/test changes. The reported payment was **correct under the app's canonical rule data**, and the CLA-124/125 fold is demonstrably NOT starved on this lane.

**The premise is false — FeyRanger is not an Evasion holder.**
- Canonical data: `public/data/2024/classes.json` grants own-Evasion only at Monk lv7 / Rogue lv7 (`{"type":"evasion","saveType":"DEX"}`); shareable **Leading Evasion** (lv14, `shareable:true, shareRange:5`) belongs to the **Bard**. The 2024 Ranger table has NO Evasion feature (lv7 row is the `Subclass feature` placeholder); `FeyRanger.json` contains zero evasion mentions.
- Live ground truth: React-fiber probe on her mounted sheet read `playerStats.evasionEffects: []` (rules 2024, lv17, Ranger). (If the table is ever reconciled with real-world PHB-2024, which gives Rangers lv7 Evasion, that is a rule-data authoring decision — per house canon, the JSON is truth and the adjudication already honors it.)

**Repro re-run live (exact steps, :5173):** same face reproduced — prompt showed `SAVE SUCCESS — Total: 21 vs DC 19 — d20 (13) + 8` with the Evasion note, then Results `FeyRanger: Saved — takes 8 Fire damage (…, halved)` (raw 16 this roll), `hp_change −8 (81/89)`. But the disk books also carry `leading_evasion_declined` — "no allies selected; every unselected target pays normal save damage" — because repro step 6 **Skips the Leading Evasion chooser**. Skip + non-holder ⇒ half-damage payment on a dcSuccess-'half' save is exactly the CLA-211 doctrine (unit-pinned `saveProcessing.cla211-leading-evasion.test.js`, `SavePromptModal.cla211-leading-evasion.test.jsx`: unselected ally dispatches `evasionActive:false`) and RAW.

**Positive controls — the fold fires live on this exact lane when evasion exists:**
- Grant leg (fail): re-cast, tick FeyRanger at the chooser → `Apply Evasion (1)`; nat-1 save (9 vs DC 19) → `rollType:'evasion'` ledger row `Leading Evasion — FAILURE, finalDamage:7` (15 → floor-half 7). ✓
- Grant leg (success): third cast, granted again, rolled 18 + 8 = 26 → Results `FeyRanger: Saved — takes no damage`, `evasion … SUCCESS, finalDamage:0`, damage row `21 (3d6+5 [Empowered Evocation]) Fire → 0 final`, NO hp_change row. ✓ (Also closes the exploration map's blocked item "the evasion fold's preferred branch never witnessed firing live".)

**"Likely location" corrections.** `SaveAttackAoeModal.jsx:1678` (`combatSummary.creatures.filter(type==='player')`) is a LOCAL inside `resolveAllSavesAndDamage` serving the NPC/passive-defense legs; the prompt-adjudication caller `handleSaveResult:1852` uses the component's `characters` PROP, which threads App `computedCharacters` (full PlayerStats) → CharSheet → CharActions → CharActionModals → SecondaryModals → SpellEffectModals. The roster is not starved on this path, and `detail.evasionActive` is stamped by the roller (`SavePromptModal.jsx` `lastEvasionState` → `buildResultDispatchDetail:382`) and consumed (`evasionUtils.js:82`) — it was honestly FALSE on the skipped cast because the roller's own shared branch gates on the GM's selection.

**The real defect found (filed separately):** the prompt's `EvasionNote` shared branch (`SavePromptModal.jsx:734-741`) still uses the pre-CLA-211 blanket shareable-holder presence test, so it prints "Evasion: No damage on success, half damage on failure" to targets that will pay the half — which is what misled the black-box report. Filed as `bug-saveprompt-evasion-note-promises-unselected-leading-evasion.md`. The `save_lapsed` phantom row observed again mid-ride belongs to the already-open `bug-aoe-live-save-stamped-reload-lapse`.

**Closeout:** overlays cleared, Admin clear-change-data + clear-log via API (verified `{}` / `[]` / `[]`), battle-arena md5 `94fcd0bf…` and 15-char aggregate `9c851a53…` pins byte-exact, dev pair killed by PID, ports dark.
