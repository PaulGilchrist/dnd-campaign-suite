# App Exploration Map

**KB FIX-VERIFY DESCENT family — 2026-11-14 run MM (post-Explore four-commit batch: `3a99fd08a` death-save ghost-key 404-sweep + `9c3ec68ea` HoH-picker-live-echo + `579cbbe27` picker Heal-self/Cancel labels + `5c114db7b` sheet-hp sourceName stamp — ALL FOUR LIVE-VERIFIED; LC's PT#3 (picker-stage staleness) CONSUMED; the echo improve's application-leg twin surfaced 1 NEW BUG: `bug-hoh-negative-heal-stale-snapshot-clamp.md` (a HoH commit whose dispatch-snapshot row max < bucket but live row says healable WROTE `1d12+7+2: 7+9 = -59 HP restored`: target drained 60→1, `isHealing:true` on a −59 delta, 1 Focus spent, audit description self-contradicts with "(Already at full HP)"). Death-save evict sweep re-ridden from the modal seam this time (LC rode the sheet seam): arm→resolve DELETE trio 200/200, re-arm after evict still fires the real DELETE (200), and every post-resolution clear-leg (2× sheet roll press, 2× sheet revive) sent ZERO deathSavePrompt requests — ghost face dead:**

- **Evict-sweep law (MM, `3a99fd08a` fix-verified):** the resolve DELETE's 200 response leg evicts BOTH mirror lanes (campaign store + key-named echo bucket); re-arm works (POST recreates key, echo rehydrates mirror, second resolve DELETE → 200); refused/404 answers never evict (unit-pinned `savePromptService.death-save-evict-mirror.test.js` — live face unreachable without a 403/5xx rig).
- **HoH picker live-echo law (MM, `9c3ec68ea` fix-verified but see the bug):** picker radio re-anchors every render on the LIVE combatSummary row — mid-dwell scoped PATCH `{creatures:[{name,maxHp}]}` lands in `N of M HP` + radio aria within one echo (M from live row, N bucket-canonical). Commit gate `monkHealTargetAtFullHp` reads the live cache row: stale-full press → inline `EvasiveFighter is already at full HP. No focus spent.` + picker stays open + ZERO requests; raising live max above bucket → gate allows the heal. **The allow is where the NEW BUG lands: `applyMonkHeal` still clamps on the dispatch-captured cs (CLA-092 lane → `applyHealingToTarget`/`modifyHitPoints`), so gate-live vs apply-snapshot disagreement writes the negative headroom into the bucket.** Control dwell (snapshot == live, 1 of 112) heals honestly (`5+9=14 HP restored` → 15/112).
- **Picker-skip-semantics witness (MM, `579cbbe27` re-lived):** picker footer buttons census = `Heal` / `Heal self` / `Cancel`; Cancel closes with ZERO requests (focus/heal/log untouched).
- **SourceName stamp law (MM, `5c114db7b` fix-verified both families):** CharHitPoints manual commit writes `hp_change` with `sourceName:'sheet editor'`; the GM Initiative-card input writes `sourceName:'GM HP override'` (+ note "Manual GM edit from the initiative card.", threshold "dead"). `sheet editor` copy is CharHitPoints-ONLY (grep) — a row with that stamp proves a sheet-editor commit happened on some client.
- **Anomaly note (MM, swept, NOT filed):** one `hp_change sheet editor AasimarTest −23→120` row appeared mid-session that NO MM call authored (single tab/context census proved; only writer is CharHitPoints.handleValueChange — needs a human-typed commit). Coincided with an unexplained page reload + view-flap window; likely the owner's own tab or a harness actor on this machine. Unreproducible → not filed; WATCH for recurrence. (AT bucket rode 120 to the exit sweep.)
- **MM fixture discipline:** ONE sanctioned surgery, byte-exact restored + live re-proved: Disciplined_Monk subclass Open Hand↔Warrior of Mercy (exit md5 `ba4d456c…`; Hand rows vanish + Open Hand Technique back after reload+re-select — law re-lived). All 13 char md5s canonical at exit; npcs.json `db6666c1`, notes `836a3fb6`, sessions `d7517139`, inventory `7638da67`, design-notes `d5e0f95c` untouched; maps = 4 owner fixtures never opened; campaigns/ = 5 baseline folders (no throwaways — the four commits touch no seeded/TV/delegation/allies/EB/fog/travel/AI/planner/hex files, `git show --name-only` ×4). Runtime churn (EF/AT/DM buckets, cs board rows, ~10 log rows) swept by CLOSED-TAB two-pass clears GET-verified `{}`/`[]` (pass 1 clean immediately; re-enter surfaced ONLY the select trio, pass 2 evicted; disk cd/log files absent; overlays `[]` never touched). Servers killed at exit, ports dark; git porcelain public/campaigns EMPTY.

## Historic Descent Headers

<details><summary>KB 2026-11-14 (post-JA fix-verify: `18cf0f422` pool-clamp + `544b9cbe2` HoH-echo/guard both LIVE-PASS; filed the HiddenInput bug since fixed by `08ebc98fd` and LC-verified; its HoH auto-cure-on-echo-shrink face #2 was REPLACED by `e796269ac` (mount-only) and its Escape-INERT/clear-0 HiddenInput law is DEAD — LC re-derived both live; pool/level-surgery/echo laws untouched by the post-KB commits stand carried).</summary>

**KB**: pool clamp 65/65 over stored 95 + commit self-heal + typed-70 note + HP exempt `224/147`; HoH 6-face echo+guard verify; HiddenInput clear→0 BUG FILED (resolved); level-surgery rigs; cs-row write-side residual 4th re-observation. Full text in git log of this file.

</details>

<details><summary>LC 2026-11-14 (post-KB tail fix-verify ×4 + DEATH-SAVE LANE FIRST live ride, zero bugs; its picker-stage-staleness PT#3 was CONSUMED by `9c3ec68ea` and its ghost-key-404 backlog by `3a99fd08a` — both MM fix-verified; MM re-rode the modal seam (arm/roll/fail panel/trio/re-arm) and the sheet seam (roll-press × counter persistence, revive) consistently with LC's law set. Its HoH auto-cure/echo laws stand carried, event-clear (post-LC commits touch only `savePromptService.js`, `HandOfHealingModal.jsx`, `healingHandler.js`, `SecondaryTargetModal.jsx`, `CharHitPoints.jsx`).</summary>

**LC**: death-save lane deep (arm law, modal faces, DEAD/STABLE finality from both seams, RAW stable-at-0, void guard, (1 of 2) queue, late-joiner replay, result-key self-sweep); HiddenInput 5/5 (blank/Escape cancel, explicit-0 commits); HoH cs-echo + mount-only autocure PASS; sheet-death-save seam deep (sheet never arms). Full text in git log of this file.

</details>

<details><summary>JA/IZ/GZ/FX+EH+DG+BE+CF/AD..GB descents 2026-11-13/14 (carried, event-clear against the post-LC batch — those commits touch only the five files above; clamp-hint law, heal dwell mechanics, EB/fog/travel/AI/planner/hex/TV/delegation/allies laws UNTOUCHED).</summary>

**JA**: clamp hints + latch PASS. **IZ**: cure-echo 5 faces (auto-cure face superseded by e796269ac, LC-verified). **GZ**: stale-closure + pre-spend gate. **FX/EH/DG/BE/CF**: batch cure, hex POI a11y, music orphan, modal-family Escape/backdrop, allies row editor, victory stamp, DeleteConfirmModal. **AD..GB**: reject-modal lineage, name-laws, AI matrix, regen envelope, dice glyphs, planner CUD, mount-merge, enforcement/travel/weather/3D/sheet/PFEG/long-rest/AoE/aura laws. Full text in git log.

</details>

## Priority Targets (next descent)

1. **FIX-VERIFY `bug-hoh-negative-heal-stale-snapshot-clamp.md`** when a fix lands: re-run the divergent-dwell rig (bucket 60 + snapshot row 1/1 + mid-dwell cs PATCH maxHp 112) → expect positive heal capped at live headroom (or refuse path), NEVER a negative `hp_change`, never a Focus spend with an "Already at full HP" description; re-run the honest control dwell (1 of 112 → 14 restored) to pin no regression.
2. HP-side owner ruling (was LC PT#2, unchanged): pool lanes clamped, HP badge exempt by design (`CLAMP_EXEMPT_KEYS = ['currentHitPoints','hitPoints']` — MM re-checked, no new commits) but renders inverted fractions on overshoot (`224/147`). Owner: fold HP into the clamp family (temp-HP semantics) or rule honest-by-design and pin the face.
3. cs-row write-side residual (PT#3 family, 6th re-observation MM): the picker's mount-snapshot aria can read `60 of 1 HP` — bucket current vs fan-out-placeholder max — until any echo re-anchors it; cosmetic honesty face of the same bucket-canonical decision.
4. Fanatical-focus RESET positivity leg + Natural-RNG weatherChange dialog + Camp-while-PAUSED + Designer TRIM-DROPPED + POI `enter_refused` click face (carry-over blocked rows, unchanged).
5. `DeathSavePromptModal` resolved-id-guard RACE face + nat20 `Restored to 1 HP` live face (unchanged — deterministic rig unknown; both unit-pinned).

## Depth Seeds (live 2026-11-14 MM unless noted)

- **Evict-sweep law (MM, `3a99fd08a`):** resolve-time DELETE (200) evicts the key from BOTH mirror lanes → every later clear-leg (sheet death-save roll press, sheet revive >0) sends ZERO `deathSavePrompt-*` requests; re-arm→resolve fires a fresh 200 DELETE (real evicts never skipped); counter tracks persist across the modal seam (roll 6 → sheet shows `Failures: ⬤◯◯`).
- **Death-save lane laws (LC, deep; MM re-rode modal+sheet seams consistent):** arm = GM Initiative-card HP transition >0→0 (`writePlayerHp`; a 0→0 fill is honestly not a transition — the sheet CharHitPoints editor NEVER arms); prompt key `deathSavePrompt-<Name>`; modal `.dsp-overlay`, roll button `.dsp-roll-btn`; network trio POST result → DELETE prompt → DELETE result (result key self-swept); finality rows only on stable/dead; stable leaves HP at 0 (RAW); void guard = scalar PATCH HP>0 while armed then Roll → clear+advance, zero writes/rows; late-joining select REPLAYS an armed prompt.
- **HoH picker live-echo + gate law (MM, `9c3ec68ea`):** picker re-anchors `N of M` + radio aria per render on the live cache row (N=bucket-canonical, M=live row max; a no-live-row target keeps its snapshot byte-identically); commit gate reads the live row (full→inline refusal + zero requests; raised-max→allowed). **Apply leg is the open bug** — see Priority Target 1.
- **HoH chooser family (MM re-lived + 579cbbe27/KB/JA laws):** picker root `[role=dialog][aria-labelledby=hand-of-healing-target-modal-title]`, result root `…-hand-of-healing-modal-title`, footer `Heal`/`Heal self`/`Cancel` (Cancel = zero-spend); result stage `(N / M HP)` + `XdY + mod: dice = total HP restored` between Roll and `Done`; Focus materializes into the DM bucket on first spend (`focusPoints`).
- **HiddenInput cancel law (LC, `08ebc98fd`):** blank-trim commit CANCELS, Escape CANCELS, explicitly typed values (incl. `0`) commit; consumed via the `.clickable`-hasText-`Hit Points:` → inner `input` fill+Enter recipe (MM re-lived).
- **SourceName stamp law (MM, `5c114db7b`):** `sheet editor` (CharHitPoints ONLY — forensic key) vs `GM HP override` (Initiative card). Revive>0 from sheet also resets `deathSaves`/`deathFailures`/`isDead` buckets (observed as 3 extra POSTs).
- **Disk subclass swap law (LC; MM re-proved both directions):** reload + re-select required (select hydrates char JSON); restore md5 `ba4d456c…` + live row census re-proof.
- **Pool-clamp/level-surgery/clamp-hint/heal-dwell laws (KB/IZ/JA):** carried — event-clear.
- **Throwaway lanes / quick-create / seeded campaigns / TV / delegation / allies / EB / fog / travel / AI / planner / hex-POI / victory / music / modal-family:** carried — event-clear (`git show --name-only` on the four post-LC commits: only `savePromptService.js`, `HandOfHealingModal.jsx`, `healingHandler.js`, `SecondaryTargetModal.jsx`, `CharHitPoints.jsx` + tests/docs).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| DEATH-SAVE lane (arm/modal/roll/queue/finality/void/late-join/self-sweep) | deep (LC 2026-11-14 first ride; MM re-rode modal+sheet seams + re-arm-after-evict, all consistent) | `components/common/DeathSavePromptModal.jsx`, `services/combat/conditions/savePromptService.js`, `services/rules/combat/applyDamage.js`, `components/initiative/createCreatureHandlers.js`, `char-sheet/char-summary/DeathSavingThrows.jsx` |
| Evict-mirror-gate + ghost-key sweep: FIX-VERIFIED `4015d88d4` (LC) + `3a99fd08a` (MM — post-resolve clear-legs send ZERO requests; re-arm→200 DELETE intact) | deep (MM 2026-11-14) | `savePromptService.js` `evictDeathSavePromptMirror` |
| HoH picker stage: live re-anchor (aria + labels) mid-dwell, bucket-canonical N, snapshot-keeps-when-no-row; + `Heal self`/`Cancel` zero-spend faces | deep (MM 2026-11-14, `9c3ec68ea`+`579cbbe27` fix-verified; spawned bug — apply leg) | `char-sheet/modals/shared/HandOfHealingModal.jsx` `reanchorTargetsToLiveBoard`, `SecondaryTargetModal.jsx` |
| HoH commit gates: stale-full refusal (zero requests), raised-max allow, honest control heal (`14 HP restored` face) | deep (MM 2026-11-14) — but negative-write face FILED `bug-hoh-negative-heal-stale-snapshot-clamp.md` | `services/automation/handlers/healing/healingHandler.js` `monkHealTargetAtFullHp` / `applyMonkHeal`, `rules/combat/applyHealing.js` `modifyHitPoints` |
| HiddenInput sheet editors: blank commit + Escape CANCEL; explicit-0 commits; `Hit Points:` badge recipe | deep (LC 2026-11-14; MM re-lived revive face) | `src/components/common/HiddenInput.jsx`, `CharHitPoints.jsx`, `TrackedResourceInput.jsx` |
| hp_change audit families: `sheet editor` vs `GM HP override` stamps | deep (MM 2026-11-14, `5c114db7b` both legs + forensic grep) | `CharHitPoints.jsx`, `createCreatureHandlers.js logManualHpOverride` |
| Pool-clamp family, level-surgery rigs, subclass swap recipe, clamp hints, heal dwell, ownership census | deep (KB/JA/IZ — carried, event-clear; MM re-rode swap+restore both directions) | `useTrackedResource.js`, `HealingPoolModal.jsx`, `TrackedResourceInput.jsx` |
| cs-row write-side residual (product decisions PT#2/PT#3) | 6th re-observation MM 2026-11-14 | `combatSummary` consumers, bucket-first resolve |
| Seeded quick-create + arena census + wizard-× + API delete ghost + dismiss law / hex POI a11y / victory + stamp / DeleteConfirmModal / music / EB+fog+travel / AI lanes / planner CUD / TV + delegation + allies | carried — event-clear (post-LC commits touch no files) | per KB/FX/EH/CF/DG/BE/MA/LZ/JV/KW/OP/RS/TE/SD/XA tags |

## Baseline Fingerprints (canonical test-campaign state at MM exit — verified 2026-11-14)

change-data `{}` + log `[]` + overlays `[]` (tabs CLOSED before clears; pass 1 clean, re-enter surfaced ONLY the select trio, pass 2 GET-verified, disk cd/log files absent); all 13 char files md5-canonical (DM `ba4d456c…` post-surgery restore live re-proved — Hand rows gone, Open Hand back); npcs.json `db6666c1`, notes `836a3fb6`, sessions `d7517139`, inventory `7638da67`, design-notes `d5e0f95c`; maps = 4 owner fixtures never opened; campaigns/ = 5 baseline folders (no throwaways); `git status --porcelain public/campaigns/` EMPTY; console errors = SSE teardown/reap noise only (dev-pair died mid-session once — playbook §2 survival law; relaunched `background:true` served the rest). Servers killed at exit, ports dark.

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

- **2026-11-14 MM — HoH picker mount snapshot can render an inverted fraction** (`Select EvasiveFighter, 60 of 1 HP`): the open-moment row is a fan-out placeholder (maxHp 1) while the bucket carries real HP; the next echo re-anchors (9c3ec68ea) but the first paint is confusing. Suggest: at `collectTouchTargets`/snapshot time, prefer the target's own max (`hitPoints` from char data/bucket) over a placeholder row maxHp — pairs with the PT#3 owner decision. `src/services/automation/handlers/healing/healingHandler.js collectTouchTargets` + `liveTargetHp.js`.
- **2026-11-14 MM — the ability_use audit description and the write can contradict** (same click produced `= 16 (Already at full HP)` AND a −59 `hp_change` row with `isHealing:true`): even beyond the filed bug's clamp fix, stamp `isHealing` from the delta SIGN and suppress the `(Already at full HP)` clause on any path that still wrote/spent (the bug fix should route it to the refuse path — this bullet pins the audit-hygiene half). `healingHandler.js healDesc`/row builders.
- **2026-11-14 MM — the sheet-revive lane writes 3–4 separate POSTs in one user action** (hp value, deathSaves, deathFailures, isDead as individual `POST /<Char>` full-bucket writes): each broadcasts its own SSE echo; a single merged full-store POST would halve the chatter on every revive. `CharHitPoints.jsx handleValueChangeCurrentHitPoints`.

## Blocked / Not Verified (fold-gate ledger)

- `3a99fd08a` non-confirming-response face (403/423/5xx keeps the mirror, retries the evict) — live-unreachable without a response-poison rig; unit-pinned `savePromptService.death-save-evict-mirror.test.js`.
- AasimarTest `sheet editor −23→120` mystery row (MM) — only writer is CharHitPoints (needs a typed commit); single-tab census rules out my client; unreproducible, environmental suspicion (owner tab / harness actor). WATCH list, not a bug file.
- Death-save resolved-id-guard RACE face — unreachable deterministically at human speed; unit-pinned `DeathSavePromptModal.cross-tab.test.jsx`.
- Death-save nat20 `Restored to 1 HP` live face — ~5% real dice, no forcing rig; unit-pinned.
- Designer TRIM-DROPPED live face — accept the unit pin unless a scripted-model rig ships (carried).
- Natural-RNG weatherChange dialog (carried — synthetically ridden JU).
- Camp-while-PAUSED leg (carried — structurally hard to co-instantiate).
- POI `enter_refused refusal:'missing'` CLICK face (carried — live-unreachable by law, unit-pinned).
- Fanatical-focus RESET positivity leg (carried — unit-pinned; absence leg JA-verified).
- HoH commit-guard BUCKET-side race face (carried — accept unit pins; cs-side face KB-verified).
- Display-clamp `_trackedResources` producer branch live face (carried — unit-pinned).
