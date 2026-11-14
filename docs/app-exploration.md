# App Exploration Map

**JA FIX-VERIFY-DESCENT — 2026-11-14 (post-IZ tail = the two improves IZ's backlog anticipated: `633d5c552` heal-amount-clamp-hint (HealingPoolModal.jsx + new pool-clamp-hints test) and `0eac679b0` fanatical-focus-latch-gate (CharSheet.jsx + actionHandlers test) — both LIVE-VERIFIED PASS this run; plus the two open Priority Targets consumed: PT#2 level-down pool-overshoot CONFIRMED (1 bug FILED) and PT#3 HoH-picker conditions-echo CONFIRMED stale (1 bug FILED). PT#4 (fanaticalFocusUsed ghost) CLOSED by the shipped gate. Console 0 app errors (1 own harness-predicate artifact), zero non-2xx (own goto-teardown SSE ERR_ABORTED only):**

- **Clamp hints (`633d5c552`) — FIX-VERIFIED PASS both faces, deep.** Face A (L20, pool 100/100, EF 90/112): typed `150` → amount input DISPLAY `100`, note `Amount clamped to the remaining pool of 100 HP.` renders, Apply stays enabled, commit is honest (capacity-clamped 22, ledger `Heal|EF|22|78`, then full-HP verbatim refusal on re-press). Face B (mid-dwell scoped PATCH pool→0): pool line adopts to `Pool: 0 / 65 HP` within one SSE tick, note `Healing pool exhausted — no HP left to spend, so Apply Heal is disabled until the pool recovers.`, Apply `disabled`, brute force-click = ZERO ledger change. IZ's silent-clamp backlog bullet RESOLVED.
- **Fanatical-focus latch gate (`0eac679b0`) — FIX-VERIFIED PASS (absence leg).** Fresh baseline → select → open EvasiveFighter sheet: GET change-data after the debounce shows NO `fanaticalFocusUsed` key in ANY bucket, and the EF bucket is not even created by the sheet-open any more (pre-fix IZ census: it rode every sheet-opened bucket). Positivity leg (consumed-latch reset) is rage-gated and unit-pinned by `CharSheet.actionHandlers.test.jsx` — accepted. IZ's backlog bullet RESOLVED.
- **PT#2 STALE-STORED-CURRENT POOL — CONFIRMED BUG FILED (`bug-stale-level-down-pool-overshoot.md`), deep.** Rig (IZ one-field surgery MINUS the bucket wipe): sheet-open once (seeds owned `layOnHandsPool`), real heal L20 (100→78), scoped PATCH pool→95, disk `"level": 20`→`13`, reload+re-select. Live: badge `Lay On Hands Pool: 95/65 (cur/max)`, modal `Pool: 95 / 65 HP`, amount `max="95"`, commit of 70 fully SUCCEEDS (EF 40→110, ledger `Heal|EF|70|25`) — a level-13 paladin spends 70 from a class capacity of 65; the overshoot persists across a full reload untouched (no read-clamp). Side face on the same rig: bucket `currentHitPoints:224` (L20-era) rides the L13 derived max 147 → chooser row `Select ElderPaladin, 224 of 147 HP` — HP obeys the same no-clamp law (`useTrackedResource.js resolveCurrent` returns stored verbatim when the key exists). ROOT CAUSE read-confirmed: `resolveCurrent` never `min(stored, maxGetter())`; `addPaladinDivineResources` seeds only where the key is ABSENT.
- **PT#3 HOH-PICKER CONDITIONS ECHO — CONFIRMED STALE, BUG FILED (`bug-hoh-physicians-touch-stale-conditions-phantom-row.md`), deep.** Mercy-swap rig (DM `Warrior of the Open Hand`→`Warrior of Mercy`, reload auto-derives `Hand of Healing:`/`Hand of Harm:`/`Hand of Ultimate Mercy:` rows). `SecondaryTargetModal` picker rows ARE HP-live (aria `Select EvasiveFighter, 77 of 112 HP` adopted mid-dwell) — but the RESULT stage's `PhysiciansTouchSection` snapshot-laws: (face 1) single-cure auto-heal honest (`Condition Cleared — Poisoned removed`), `stunned` applied externally mid-dwell never surfaces a section (RAW-defensible there — touch spent — but confirms zero conditions subscription); (face 2, the real bite) 2-cond heal → `Remove Blinded`/`Remove Stunned` buttons, external cure of Blinded mid-dwell (bucket now `["stunned"]`) does NOT retire the button, and the stale press writes + logs a PHANTOM `condition`/`broken`/`Blinded` row (sourceName `Disciplined_Monk (Hand of Healing)`) with the bucket byte-unchanged — the display-echo AND commit-guard that `82f517b26`+`615a7580a` shipped for HealingPoolModal are both absent in `HandOfHealingModal.jsx`.
- **IZ carry-forwards honored without re-walking:** cure-echo-live-conditions (`82f517b26`) law unchanged (its fix's file untouched by the post-IZ tail per `git show --name-only` — only the two improvement notes added); batch-merged-write, ownership census (ee3c3e7a7 — re-sampled clean this run: no paladin pools on the Fighter sheet-open, the opened-char bucket law now honestly class-gated), PT#2 cs-row write-side residual (re-observed: heals moved EF bucket while hand-rolled cs row stayed seeded value — product decision, unchanged); throwaway/seeded/TV/delegation/allies/EB/fog/travel/AI rows event-clear (post-IZ tail touched only HealingPoolModal.jsx + CharSheet.jsx + docs). qa-arena/qa-starter NOT created; campaigns/ stayed the 5 baseline folders all run.
- **JA fixture discipline:** TWO sanctioned surgeries, both byte-exact restored + live re-proved: ElderPaladin `"level"` 20→13→20 (md5 `6e4341e4…` at exit, badge 100/100 live), Disciplined_Monk subclass Open Hand→Mercy→Open Hand (md5 `ba4d456c…` at exit, `Hand of Healing` row vanish live re-proved). All 13 char files md5-identical to run-start census; classes.json NEVER opened. Runtime churn (pool 100→78→95→…→0, EF buckets/conds through 5 full-store POSTs, hand-rolled 3-row cs, ~13 log rows incl. the phantom row) swept by CLOSED-TAB single-pass clears (tab closed BEFORE the admin-clear POSTs — `{}`/`[]` GET-verified, disk cd/log files absent, overlays `[]` never touched). Servers killed at exit, ports dark. `git status --porcelain` = the two bug files only.

## Historic Descent Headers

<details><summary>IZ 2026-11-14 (five-fix healing era: cure-echo fix-verified 5/5 — its echo law STANDS (HP AND conditions both live into the dwelling HealingPoolModal); native sub-L14 rig + pool-exhaustion faces STAND and were re-used by JA; its `fanaticalFocusUsed` per-open ghost claim is DEAD — fixed+verified by `0eac679b0` this run).</summary>

**IZ**: cure-conditions live echo PASS 5/5 faces (rows appear/retire/prune/abolish mid-dwell); PT#1 native sub-L14 PASS (level-surgery rig, pool 65=5×level) retiring the synthesis caveat; pool-exhaustion clamp face PASS; ownership census cross-check; two backlog bullets (both shipped + JA-verified).

</details>

<details><summary>HZ 2026-11-14 (five-fix healing sweep — amount-lane capacity-clamp, batch-merged-write, owner-pool and PT#2 claims STAND; its "echo is HP-only" law was superseded by `82f517b26`, itself JA-stable).</summary>

**HZ**: all five GZ-era fix-verifies PASS; modal result DWELLS across sheet navigation — click its `Done` before switching characters; victim = full-store POST pre-select hydrates the mirror; scalar PATCH lands commit-time-live.

</details>

<details><summary>GZ 2026-11-13 (pre-fix healing descent — its cure lanes superseded by the fixes GZ/HZ/IZ verified; dice-lane stale-closure `88daae2be` + HoH pre-spend gate `f3950317c` commit-time law unchanged).</summary>

**GZ**: PT#1 stale-closure fix-verify PASS, HoH pre-spend gate PASS 4/4 (refusal keeps picker open — JA re-witnessed the picker open across calls), batch running-pool + cure-audit casing PASS.

</details>

<details><summary>FX + EH + DG + BE + CF descents 2026-11-13 (carried by GZ/HZ/IZ/JA, event-clear; full text in git log of this file).</summary>

**FX**: batch cure tier + bloodiedOnly rides, Physician's Touch both faces. **EH**: hex POI a11y tier, quick-create dismiss law 3/3, paladin Bonus-Actions routing. **DG**: music orphan-fix PASS, wizard walk, native-confirm holdouts, POI-delete road cascade. **BE**: modal-family Escape/backdrop 5/5, allies row editor, FF arms via `<select aria-label="<Name> target">`. **CF**: victory stamp law, DeleteConfirmModal 14 faces, map players-reconcile eviction.

</details>

<details><summary>AD/ZC/XA/WY/VX/VG/UF-era records (full text in git log of this file)</summary>

**AD** reject-modal lineage + race-loser copy. **ZC** kind-word name-laws + keeper narrative kinds. **XA** referee/director/erasure-guard 5/400 matrix. **WY** regen envelope + hex board-open law. **VX** regen byte-identity. **VG** Fisher-Yates SHAs. **UF** generate-modal batch. **TE** grid hints. **SD** maps-manager pair. **RS** dice glyphs + zero-subject Initiative + typed-name delete. **QR** mount-merge guard + zerochar witness. **OP** planner CUD + quick-create modal DOM law. **NN** swap-law 4/4. **MB/MB-2** TV law bundle + music write law. **MA** write_rejected verify + visitor plain-text initiative + FF faces. **LZ** TV family + allies betrayal flip. **KW/JV/JU/JT/IF/IE/HD/GC/GB** enforcement/travel/weather/POI/marching/3D/sheet/PFEG/long-rest/AoE/aura laws.

</details>

## Live-Claims Folded History

<details><summary>AD/ZC/XA/WY/VX/VG/UF-era laws (full text in git log of this file)</summary>

**AD** reject-modal lineage. **ZC** name-laws. **XA** AI 5/400 matrix. **WY** regen envelope. **VX** regen byte-identity. **VG** SHAs. **UF** generate batch. **TE** grid hints. **SD** maps pair. **RS** dice glyphs. **QR** mount-merge. **OP** planner CUD. **NN** swap-law. **MB** TV/music laws. **MA** delegation. **LZ** allies flip. **KW..GB** enforcement/travel/weather/POI/marching/3D/sheet/PFEG/rest/AoE/aura.

</details>

## Priority Targets (next descent)

1. FIX-VERIFY the two JA bugs when fixes land: `bug-stale-level-down-pool-overshoot.md` (clamp-at-resolve) and `bug-hoh-physicians-touch-stale-conditions-phantom-row.md` (HoH echo + commit guard). JA rigs are recorded in Depth Seeds — both are one-reload rides.
2. Level-down HP side-face (`currentHitPoints` bucket above new derived max → `224 of 147 HP` chooser row): fold into the pool-clamp fix or an owner ruling — same `resolveCurrent` family, HP semantics need care (temp HP).
3. cs-row write-side residual (product decision, unchanged since GZ; JA re-observed): heals never WRITE `combatSummary` player rows — choose: honest row-refresh or an owner ruling to keep buckets canonical.
4. HoH auto-cure latch under the future echo fix: the fix must NOT grant a second free cure when a new condition surfaces mid-dwell (one Physician's Touch per use) — pin it in the fix's tests.
5. Carry-over blocked: Natural-RNG weatherChange dialog; Camp-while-PAUSED; Designer TRIM-DROPPED (unit-pinned); POI enter_refused click face (live-unreachable).

## Depth Seeds (live 2026-11-14 JA unless noted)

- **Level-surgery rigs (JA, deep — both legs byte-exact restored):** EP one-field `"level": 20`↔`13` (unique string, no `class_levels` key) — WITH bucket wipe = native sub-L14 face (IZ), WITHOUT wipe = stored-overshoot face (JA): open sheet at L20 first (seeds `layOnHandsPool:100`), real heal to register the key, scoped PATCH `{"value":{"layOnHandsPool":95}}` (GET-verify; `applied:0` counter lie law), then level-down + reload + re-select → badge `95/65`. DM subclass swap `"Warrior of the Open Hand"`↔`"Warrior of Mercy"` (disk `class.subclass.name`, unique) — reload auto-derives `Hand of Healing:`/`Hand of Harm:`/`Hand of Ultimate Mercy:` clickable rows; exit md5s EP `6e4341e4…`, DM `ba4d456c…`. HoH ride: `b.clickable` row → picker `#hand-of-healing-target-modal-title` (radio `Select <Name>, N of M HP` force-click + `Heal`) → result `#hand-of-healing-modal-title`; PHYSICIAN'S TOUCH laws (JA): options = snapshot-at-open (no `activeConditions` subscription; `liveHp` picker rows ARE HP-live); commit has NO presence guard — stale press = zero-delta write + phantom `condition|broken` row + `Condition Cleared` success panel; single-curable auto-cures on mount (once via `curedOnMount` ref), multi = `Remove <Label>` buttons.
- **Clamp-hint faces (JA, deep):** typed amount > safePool → display clamps + note `Amount clamped to the remaining pool of {safePool} HP.`; safePool 0 (mid-dwell scoped PATCH pool→0 rides the dwelling modal) → note `Healing pool exhausted — …`, Apply `disabled`, brute-click inert. Note seam = `.healing-restriction-note` (may hold 1-2 notes at once, e.g. full-HP refusal + clamp).
- **Healing confirm lanes (IZ-carried, event-clear):** full-store `POST /<Char> {value:{…}}` mid-dwell adoption for conds; LoH batch commit = one merged target POST + one pool POST + N cased rows; feature rows are `<b class="clickable">` with text `<Feature>:`; amount display `Math.min(healAmount,safePool)`. JA re-rode single heal + full-HP refusal + pool-exhaustion legs honestly.
- **Sheet-open write census post-gate (JA):** opening a NON-paladin sheet now writes NOTHING to its bucket (no latch reset, no ghost pools — `0eac679b0`+`ee3c3e7a7` composed); the select fan-out trio (`combatSummary`/`__campaign__`/`AasimarTest`) still seeds every select.
- **Throwaway lanes / quick-create / seeded campaigns / TV / delegation / allies / EB / fog / travel / AI / planner / hex-POI:** carried — event-clear (post-IZ tail `633d5c552`/`0eac679b0`/`0b7263e3c` touch only HealingPoolModal.jsx + CharSheet.jsx + docs per `git show --name-only`; nothing moved in those paths since their EH/DG/CF/BE/FX/GZ/MA tags).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Amount-lane honesty incl. NEW inline clamp/exhaustion hints (typed 150 → `Amount clamped…`; pool→0 mid-dwell → exhausted note + disabled + inert brute-click) | **deep (JA 2026-11-14 `633d5c552` fix-verified both faces; prior HZ/IZ capacity/exhaustion faces re-rode honest)** | `char-sheet/modals/divine/HealingPoolModal.jsx` `HealingApplySection`, `HealingPoolModal.pool-clamp-hints.test.jsx` |
| Stale-stored pool vs derived max (level-down, no bucket wipe): badge/modal `95/65`, over-cap spend 70 SUCCEEDS, overshoot persists reload; HP same law (`224 of 147`) | **deep (JA 2026-11-14 — CONFIRMED, BUG FILED `bug-stale-level-down-pool-overshoot.md`)** | `src/hooks/runtime/useTrackedResource.js` `resolveCurrent`, `HealingPoolModal.jsx` `safePool`, `trackedResources.js` `addPaladinDivineResources` |
| HoH Physician's Touch echo+guard: snapshot-at-open options, stale press → phantom `condition broken` row + zero-delta write + false success panel (picker HP-echo intact) | **deep (JA 2026-11-14 — CONFIRMED, BUG FILED `bug-hoh-physicians-touch-stale-conditions-phantom-row.md`; single/multi/commit legs all witnessed)** | `char-sheet/modals/shared/HandOfHealingModal.jsx` `PhysiciansTouchSection`, `SecondaryTargetModal.jsx` `liveHp` |
| Tracked-resource ownership post-gate: non-paladin sheet-open writes NOTHING (no `fanaticalFocusUsed`, no ghost pools, no bucket created) | **deep (JA 2026-11-14 `0eac679b0`+`ee3c3e7a7` composed-fix-verified, absence leg; positivity leg unit-pinned)** | `CharSheet.jsx` reroll-latch effect, `trackedResources.js` owned-only seeds |
| Cure-echo live conditions into dwelling HealingPoolModal (5 faces) + batch merged write + native sub-L14 + pool exhaustion | deep (IZ 2026-11-14 `82f517b26` — carried, event-clear: post-IZ tail touched only the two note additions + latch gate) | `HealingPoolModal.jsx` subscriptions, `SecondaryTargetModal.jsx` |
| PT#2 cs-row write-side residual (heals never write cs player rows) | re-observed JA 2026-11-14 (product decision, Priority Target #3) | `combatSummary` consumers, bucket-first `resolveTargetCurrentHp` |
| Dice-lane stale-closure refund + HoH pre-spend gate | deep (GZ 2026-11-13 — carried, event-clear; JA re-witnessed the picker-stays-open law mid-rig) | `HealingPoolModal.jsx` `resolveTargetCurrentHp`, `HandOfHealingModal.jsx` refusalNote |
| full-HP dice gate, capacity clamp, chooser bucket-first + `Select <Name>, N of M HP` aria | deep (FX/HZ/IZ/JA — aria + bucket-first + force-click+Heal-commit re-ridden JA) | `HealingPoolModal.jsx`, `SecondaryTargetModal.jsx` |
| Seeded quick-create + arena census + wizard-× + API delete ghost + dismiss law | deep (FX/EH 2026-11-13 — carried, event-clear) | `campaign-selection/SeededCampaignModal.jsx`, `hooks/ui/useModalDismiss.js` |
| Hex POI context-menu a11y + Escape + rename cancel + cascades | deep (EH 2026-11-13 — carried, event-clear) | `hex-map/POIContextMenu.jsx`, `hex-map/hooks/usePoiManagement.js` |
| Victory banner + stamp law / DeleteConfirmModal family / Music lane / wizard walk / indoor-map editor + reconcile / overlay transport | deep (CF/DG 2026-11-13 — carried, event-clear) | see folded history |
| EB join → Initiative → attack → Clear, delegation family, TV, allies/FF, fog/tokens/travel/marching/weather, planner CUD, AI lanes, sheet/log/SSE/select/zerochar, hex write law | carried — event-clear (post-IZ tail touches none of their files since DG/CF/BE/KW/OP/RS/XA tags) | per those tags |

## Baseline Fingerprints (canonical test-campaign state at JA exit — verified 2026-11-14)

change-data `{}` + log `[]` + overlays `[]` (tab CLOSED before the admin clears — single pass, GET-verified, zero rehydrations; disk cd/log files ABSENT); all 13 char files md5-identical to run-start census (ElderPaladin `6e4341e4…` and Disciplined_Monk `ba4d456c…` post-surgery restores, both live re-proved — badge 100/100 and Hand-rows-vanish); `git status --porcelain public/campaigns/ public/data/` EMPTY (repo porcelain = the two JA bug files only); classes.json NEVER opened; npcs/quests/design-notes never opened; maps = 4 owner fixtures untouched; campaigns/ = 5 baseline folders (no throwaways created this run); console 0 app errors (1 own `waitForFunction`-predicate wrapper-scope ReferenceError — harness artifact), zero non-2xx (own 5× SSE ERR_ABORTED = goto teardown); servers killed at exit (ports dark).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

## Blocked / Not Verified (fold-gate ledger)

- Designer TRIM-DROPPED live face — accept the unit pin (`designer.plan-scope.test.js`) unless a scripted-model rig ships (carried).
- Natural-RNG weatherChange dialog (carried — synthetically ridden JU).
- Camp-while-PAUSED leg (carried — structurally hard to co-instantiate).
- POI `enter_refused refusal:'missing'` CLICK face (carried — live-unreachable by law, unit-pinned).
- Fanatical-focus RESET positivity leg (latch true→false while sheet open) — requires a live barbarian rage + save reroll; unit-pinned by `CharSheet.actionHandlers.test.jsx`; JA verified the absence leg live (the shipped defect face).
