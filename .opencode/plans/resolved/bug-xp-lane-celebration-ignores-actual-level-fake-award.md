# XP-lane LEVEL UP celebration ignores the character's actual level — celebrates a DOWNGRADE as "Level 1 → 7"

## Summary
The experience-mode level-up watcher compares only `impliedLevelFromXp(previous.xp)` vs `impliedLevelFromXp(new xp)` on the runtime XP lane and never consults the character's roster `level`. A milestone character who is actually Level 8 (War_Cleric) has runtime XP of 0; awarding 26,500 XP implies level 7 — BELOW the real level — yet both clients celebrated "LEVEL UP! War_Cleric — Level 1 → 7". The Status line for roadmap Item 8 claims "downgrades never celebrate"; this is a downgrade relative to the actual level being celebrated as an award, with a fabricated Level-1 starting point the character never had.

## Steps to reproduce
1. In test-campaign (localhost GM tab), open the **War_Cleric** sheet (Level 8, milestone mode — subtitle reads `Level 8 (milestone)`).
2. Click the `(milestone)` suffix in the subtitle → the `Experience Points` modal (`.xp-modal-overlay`) opens.
3. Tick **Milestone Leveling** OFF (modal closes; two whole-bucket POSTs to `change-data/War_Cleric` — runtime only, no char-file write).
4. Click the XP suffix in the subtitle again → modal reopens; type **26500** into the XP field → **Apply**.
5. Observe the celebration banner; check a second mounted tab on the same campaign.

## Expected behavior
No level-up celebration. 26,500 XP implies level 7 (PHB ladder: L7=23,000, L8=34,000), which is below War_Cleric's actual level 8 — nothing leveled up. At minimum the span must never claim a starting level the character never had (they are Level 8, not Level 1). An XP-lane award should only celebrate when the implied level exceeds the character's actual roster level.

## Actual behavior
A `.level-up-banner` renders on the awarding tab AND on a second mounted tab via the SSE bucket echo:

    LEVEL UP!
    War_Cleric
    Level 1 → 7
    Open wizard
    Open the wizard to choose your new features.
    Continue

The `Open wizard` handoff then opens the Edit Character wizard (correctly seeded to War_Cleric / Level field) — so the whole false-award chain, including handoff, is fully live. Cold-boot guard is honest: reload + re-select with 26,500 XP persisted does NOT re-celebrate (that law passed). The fake award came from the XP lane treating the milestone character's absent runtime XP as Level 1.

## Likely location
Confident (code read): `src/components/level-up/LevelUpCelebration.jsx` — `CharacterLevelWatcher` XP lane (~lines 49–80): `const from = impliedLevelFromXp(previous.xp); const to = impliedLevelFromXp(snapshot.xp);` with no reference to the roster `character.level`. `impliedLevelFromXp(null|undefined)` returns 1 (`levelProgression.js:36` + test pins), so a milestone character's first-ever XP write always reads from=1. The milestone lane (roster level compare) is separate and unaffected.

## Suggested fix
Clamp the XP-lane award to reality before calling `onCrossing`: require `to > Math.max(from, character.level ?? 1)` — i.e., never celebrate an implied level that does not exceed the character's actual roster level, and tell the banner the true starting level (roster level) when the runtime XP lane is merely catching up (a "sync import" of XP under an already-leveled character should silently adopt, not celebrate). Alternatively/additionally: when Milestone Leveling is unticked, seed the runtime XP baseline to the current level's ladder floor so `from` starts honest. Add a watcher test pinning "level-8 milestone char, first award 26,500 XP → zero celebration".

## Severity
Broken feature (moderate). Nothing corrupts stored data, but a shipped celebration announces a level-up that did not happen — with a fabricated Level-1 origin — to every client at the table, and offers a wizard handoff for features the character already has. Honest-feedback violation in a player-facing moment.

## Resolution
FIXED 2026-11-19 (fix subagent). The "Likely location" diagnosis was verified exactly: `CharacterLevelWatcher`'s XP lane compared only `impliedLevelFromXp(previous.xp)` vs `impliedLevelFromXp(snapshot.xp)`, and `impliedLevelFromXp(0)` = 1, so a milestone character's first-ever XP write always read `from = 1`.

**Live repro pre-fix (test-campaign, two mounted GM tabs):** War_Cleric sheet → untick Milestone (runtime-only write confirmed: change-data `War_Cleric.xpMode = 'experience'`, char file untouched) → apply 26,500 XP → `.level-up-banner` `LEVEL UP! War_Cleric | Level 1 → 7` rendered on the awarding tab AND on the second tab via the full-bucket SSE echo (both tabs' `test-campaign` SSE connections confirmed live in the server log before judging).

**Fix (minimal, mirrors the milestone lane's roster-ground-truth pattern):** in `src/components/level-up/LevelUpCelebration.jsx` the XP lane now floors at the character's actual roster level —
`const floor = Math.max(impliedLevelFromXp(previous.xp), snapshot.level ?? 1); … if (to > floor) onCrossing({ name, from: floor, to });`
An implied level that does not exceed the real level is XP-lane catch-up (sync import) and adopts silently; a genuine award above the real level celebrates with the true starting level (never a fabricated Level-1). No XP-modal or award-lane writes were touched (the milestone-toggle double-POST stays as its own backlog item); `levelProgression.js` unchanged; single ruleset-agnostic ladder, so no 5e/2024 twin needed.

**Live re-verify post-fix (same two-tab rig, fresh reload onto fixed source):**
- Cold-boot anti-replay with 26,500 XP persisted → no banner (law still holds).
- XP zeroed to 0, Milestone unticked again, apply 26,500 (implies 7 < actual 8) → **zero banner on tab A and tab B** — the exact bug face is dead.
- Parity award 34,000 XP (implies exactly 8) → silent (catch-up adopts, not celebrated).
- Genuine award 48,000 XP (implies 9 > actual 8) → `LEVEL UP! War_Cleric | Level 8 → 9` on tab A **and** tab B via SSE echo — happy path intact with the honest roster starting level (this positive control also proves the earlier silences were the fix, not a dead echo lane).
- Console: zero errors/warnings on both tabs.

**Tests/lint:** new `src/components/level-up/LevelUpCelebration.actual-level-clamp.test.jsx` (6 tests, co-located, mirrors the sibling file's real-runtime-module rig: writer `setRuntimeValue` + echo `replaceRuntimeObject` lanes; pins "level-8 milestone char, untick + first award 26,500 XP → zero celebration" both lanes, parity silence, `Level 8 → 9` / `Level 8 → 11` honest spans, implied-higher floor). `npx vitest run src/components/level-up/ src/services/character/levelProgression.test.js src/App.level-up-celebration.test.jsx` → 4 files, 38/38 pass. `npm run lint` → clean (zero warnings).

**Restore/hygiene:** War_Cleric runtime `xp`/`xpMode` evicted by closed-tab two-pass campaign-scoped admin clears (`change-data {}`, `log []`, disk `character-change-data.json`/`campaign-log.json` ABSENT); `War_Cleric.json` byte-untouched at exit (md5 `1a4c9643…` = entry pin). Dev pair killed by PID, ports dark.

**Files changed:** `src/components/level-up/LevelUpCelebration.jsx` (fix + header comment), `src/components/level-up/LevelUpCelebration.actual-level-clamp.test.jsx` (new).
