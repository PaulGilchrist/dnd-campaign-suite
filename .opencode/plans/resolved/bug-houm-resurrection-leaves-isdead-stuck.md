# Bug: Hand of Ultimate Mercy resurrects without clearing the death-state keys — `isDead:1` (and `deathFailures:[t,t,t]`) stick to a living creature

**Filed:** 2026-11-14 explore run NP (post-MM four-commit descent). Live-verified against `db0ad4cf8` (dev pair, :5173, CAMPAIGN_LOCK=test-campaign,qa-arena,qa-starter).

### Summary
Warrior-of-Mercy `Hand of Ultimate Mercy` (HoUoM) restores a dead creature's HP and prints "Returns to life with N HP", but its handler writes **only** `currentHitPoints` (+ condition cure). It never resets `isDead`, `deathFailures`, or `deathSaves`, and it bypasses the `applyHealingToTarget` choke that performs that reset for every other heal-over-0 lane. The resurrected creature therefore stays flagged dead. Its next real death then renders a **DEAD badge with no death-save counter and no roll controls** on the sheet — the death-save lane is poisoned until a GM manually ×-removes the DEAD badge (or a long rest resets it via `restRules-longRest.js:168`).

### Steps to reproduce
Start from a clean test-campaign (cd `{}`, log `[]`):
1. Mount **Initiative** once (13-PC fan-out board).
2. Sanctioned fixture grant: set `Disciplined_Monk.json` `class.subclass.name` → `"Warrior of Mercy"`, reload + re-select (Hand of Ultimate Mercy: row derives on select).
3. Get a corpse: drive **EvasiveFighter** to real death (GM card HP >0→0 arms `deathSavePrompt-EvasiveFighter`; roll death saves to DEAD finality — `isDead:1` is stamped by `DeathSavePromptModal.jsx:200`). (Equivalently fast, and byte-identical to the finality write set: full-store `POST /api/campaigns/test-campaign/EvasiveFighter {"value":{"currentHitPoints":0,"isDead":1,"deathSaves":[false,false,false],"deathFailures":[true,true,true]}}` — this is exactly what the natural lane leaves behind, 0 HP + isDead — verified this run.)
4. Arm the monk's board target: scoped `PATCH /api/campaigns/test-campaign/combatSummary {"value":{"creatures":[{"name":"Disciplined_Monk","targetName":"EvasiveFighter"}]}}`.
5. On the Disciplined_Monk sheet press the exact row `Hand of Ultimate Mercy:` → confirmation popup `… Returns to life with N HP. Expended 5 Focus Points.` → Done.
6. GET `/api/campaigns/test-campaign/change-data` → `EvasiveFighter`.

### Expected behavior
Like every other resurrection/revive lane (sheet `CharHitPoints` commit >0, `applyHealingToTarget`'s `oldHp<=0 && newHp>0` reset, revivify — `revivifyService.js:91` "Canonical heal path: runtime currentHitPoints/isDead/deathSaves for PCs"), the resurrected bucket should come back clean: `isDead:0`, `deathSaves`/`deathFailures` empty — the creature is ALIVE.

### Actual behavior
- Bucket after commit: `{"currentHitPoints":31,"deathSaves":[false,false,false],"deathFailures":[true,true,true],"isDead":1}` — **living at 31 HP yet isDead=1 with three death failures**.
- Refuses along the way are honest (zero-spend popups): no target armed → `Select a target in combat first.`; armed living target → `EvasiveFighter is not at 0 Hit Points.` — the corruption is specific to the successful corpse commit.
- Knock-on, witnessed live: drive the same creature to a SECOND death (GM card 31→0 — this correctly re-arms a fresh prompt and the roll lane re-initializes the counter to `[true,false,false]` on a failed roll), then open the sheet while it is legitimately DYING at `Hit Points: 0/112` with 1 failure. The sheet renders `DeathSavingThrows.jsx:167`'s DEAD-skull panel instead of the counter, and the roll branch is hard-guarded off at `DeathSavingThrows.jsx:102` (`if (isStable || isDeadState || isDead) return`). A character entitled to death saves shows as terminally DEAD with no counter/roll controls; recovery needs the GM-only ×-remove (`death-saves-dead-remove`, writes a `result:'removed'` row that lies about the true counter) or a long rest.
- Network census of the commit: `POST /Disciplined_Monk` (focus), `POST /EvasiveFighter {"value":{"currentHitPoints":31,…stale mirror keys…}}`, `POST /log` — one char POST, so a merged reset was available to the lane for free; it simply isn't authored.

### Likely location
Confident (code read + live repro): `src/services/automation/handlers/class-cleric-paladin/handOfUltimateMercyHandler.js`
- L25 gate reads bucket `currentHitPoints` (why a natural corpse passes),
- L32 `setRuntimeValue(targetName, 'currentHitPoints', healAmount)` — the sole HP write; no `isDead`/`deathSaves`/`deathFailures` reset, and it bypasses `applyHealingToTarget` (CLA-092), whose `isPlayer && oldHp<=0 && newHp>0` block (`applyHealing.js:24-28`) is the app-wide death-state reset.
Secondary (display consumers that turn the stuck flag into the DEAD panel): `char-sheet/char-summary/DeathSavingThrows.jsx:58/102/167`.

### Suggested fix
Route the resurrection write through the same reset the sheet-revive / CLA-092 choke already performs: either (a) flip `setRuntimeBatch(targetName, {currentHitPoints: healAmount, deathSaves:[false,false,false], deathFailures:[false,false,false], isDead:0}, campaignName)` at handler L32 (one merged POST — the `db0ad4cf8` idiom), or (b) delegate the HP write to `applyHealingToTarget`/`applyHealingDirectly` so the canonical `oldHp<=0 → reset` block fires. Then pin with a unit test in the handler's test family asserting the post-resurrect bucket shape, and re-check the popup/`resurrection:true` log row is unchanged.

### Severity
**Data integrity risk** (escalating to broken feature on the target's next death): the bucket carries a self-contradictory living+dead state; any isDead consumer (`spellGateHelpers.isSpareTheDyingTarget`, sheet death-save view, damage-transition classifiers) reads a resurrected ally as dead, and the character's next dying state renders DEAD with no save lane until manual repair.

## Resolution
**FIXED 2026-11-14 (fix subagent).** The diagnosis was confirmed exactly as filed — no divergence found between the black-box guess and the real code.

**What was actually wrong:** `handOfUltimateMercyHandler.js` `applyResurrectionHeal()` wrote the resurrect through a single `setRuntimeValue(targetName, 'currentHitPoints', healAmount)` and never reset the death-state keys, bypassing the app-wide `oldHp<=0 → isDead:0 / counters reset` choke (`applyHealing.js:24-28`) and the sheet-revive merged-POST idiom (`CharHitPoints.jsx`, `db0ad4cf8`). A creature resurrected by Hand of Ultimate Mercy stayed `isDead:1` with `deathFailures:[t,t,t]` while alive at positive HP, and its next real death rendered the `DeathSavingThrows.jsx` DEAD-skull panel with no counter/roll lane. Single handler serves both rulesets (registered once as `hand_of_ultimate_mercy` in `automation/index.js:403`) — no 2024 twin needed the fix. NPC targets self-heal: monster death derives from cs-row `currentHp` (`hpModifier.js isCreatureDead`), so no dead flag exists to clear there.

**Files changed:**
- `src/services/automation/handlers/class-cleric-paladin/handOfUltimateMercyHandler.js` — player branch of `applyResurrectionHeal` now commits ONE merged `setRuntimeBatch(targetName, {currentHitPoints, deathSaves:[f,f,f], deathFailures:[f,f,f], isDead:0}, campaignName)` (suggested option (a); values match the CLA-092/sheet-revive canonical reset — note the app-wide reset writes `[false,false,false]` tracks, not empty arrays). Popup copy, focus ladder, condition cure, `combat-summary-updated`/`focus-points-updated` events, and the `healing|resurrection:true` log row are untouched.
- `src/services/automation/handlers/class-cleric-paladin/handOfUltimateMercyHandler.test.js` — mock gains `setRuntimeBatch`; HP-write test re-pinned to the merged write set; NEW regression test pins the post-resurrect bucket shape (one batch call, all four keys, HP never rides a separate single-key `setRuntimeValue`); NPC test pins that the batch reset never fires for monster targets.

**Live verification (dev pair on :5173, test-campaign, clean `{}`/`[]` start):**
1. Pre-fix repro re-run first: sanctioned Mercy swap → corpse via full-store `POST /EvasiveFighter {isDead:1, deathFailures:[t,t,t], …}` → cs-PATCH armed target → pressed `Hand of Ultimate Mercy:` → popup `Returns to life with 31 HP. Expended 5 Focus Points.` → bucket confirmed corrupted (`currentHitPoints:31, isDead:1, deathFailures:[t,t,t]`); second death (HP→0) showed the sheet face: `Hit Points: 0/112` + `.death-saves-dead-badge` ×1, zero roll controls.
2. Post-fix full repro: same rig → popup byte-shape identical (`… Returns to life with 27 HP. Expended 5 Focus Points.`), log row unchanged (`type:'healing' resurrection:true amount:27 sourceName:'Hand of Ultimate Mercy'`), bucket came back **clean**: `{currentHitPoints:27, isDead:0, deathSaves:[false,false,false], deathFailures:[false,false,false]}`.
3. Second-death face re-lived: drove the resurrected fighter back to 0 HP → sheet now renders `Death Saves` title + `◯◯◯/◯◯◯` counter + `Roll` control, **no DEAD badge**; pressing Roll resolved honestly (nat 4 → `Failures: ⬤◯◯` + `death_save` log row). Focus spend lane intact (DM bucket 20→15).
4. Tests: `handOfUltimateMercyHandler.test.js` 30/30; whole `class-cleric-paladin/` folder 321/321; adjacent `applyHealing.test.js` + `CharHitPoints.test.jsx` 24/24. `npm run lint` clean (zero warnings).
5. Exit hygiene: Mercy fixture surgery restored byte-exact (md5 `ba4d456c…`), closed-tab admin clears GET-verified `{}`/`[]` with disk files absent, dev pair killed, `git status --porcelain public/campaigns/` empty.

## Summary
Fixed Hand of Ultimate Mercy leaving a resurrected creature flagged dead: the handler's player-lane write now commits one merged `setRuntimeBatch` POST carrying `currentHitPoints` + the canonical death-state reset (`isDead:0`, `deathSaves`/`deathFailures` cleared to all-false) — the same write set the sheet-revive lane and the CLA-092 heal choke perform. Previously the resurrection wrote HP only, so `isDead:1` + `deathFailures:[t,t,t]` stuck to a living creature and its next real death rendered the sheet DEAD-skull panel with no death-save counter or roll lane until a GM ×-remove or a long rest. Live re-verified both faces (clean post-resurrect bucket; second death now shows the counter + working Roll control), with the popup/log contract unchanged and 30 handler tests (incl. 2 new bucket-shape pins) plus folder/adjacent suites and lint all green.
