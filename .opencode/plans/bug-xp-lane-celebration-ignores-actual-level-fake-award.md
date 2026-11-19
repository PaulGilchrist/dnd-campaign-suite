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
