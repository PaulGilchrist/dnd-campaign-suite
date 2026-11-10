# Save-margin rider hardcodes "also unconscious while poisoned (1 hour…)" log prose — any rider whose `also` is NOT unconscious logs a FALSE game fact to the campaign log

## Summary

`applySaveMarginRider` (src/hooks/combat/saveProcessing.js:859) grants the structured `margin.also` condition correctly, but its `condition applied` log description is a hardcoded string: "…also unconscious while poisoned (1 hour; waking on damage/shake is GM-enforced)." (saveProcessing.js:887). For any rider whose `also` is not `unconscious` — e.g. the live Thri-Kreen Bite row with `also:'paralyzed'` — the campaign log states a false fact (wrong condition AND wrong duration: Thri-Kreen poisoned is 1 minute, not 1 hour). The granted condition itself is right; only the prose lies.

## Steps to reproduce

1. Code-locked face (already pinned): `src/hooks/combat/saveProcessing.save-margin-rider.test.js:232` — `it.fails('generic rider log prose names the granted condition (Thri-Kreen paralyzed)')`. Un-marking shows: after a failed Thri-Kreen bite save (margin rider, `also:'paralyzed'`), the `Paralyzed` applied-log description does not mention "paralyzed" — it says "also unconscious while poisoned (1 hour…)".
2. Live face (test-campaign): EB-join a Thri-Kreen, attack a registered character with Bite, let the target fail the CON save; read the newest `condition` applied rows in `/api/campaigns/test-campaign/log` — the poisoned/paralyzed rows carry the drow-shaped "unconscious … 1 hour" prose.

## Expected behavior

The rider's log description names the ACTUAL granted condition (`margin.also`) and honours the base clause's own duration (Thri-Kreen: poisoned 1 minute, rider paralyzed per the monster's authored text) — never a hardcoded drow-specific fact. The Drow rider face (existing passing pins) must keep its current correct copy.

## Likely location

`applySaveMarginRider` in `src/hooks/combat/saveProcessing.js` (:859-:887) — hardcoded `description` template.

## Suggested fix

Build the description from the structured margin data (`also` condition, the context's authored duration) instead of the baked string, keeping the existing drow-row bytes identical where the data matches (parity pins). Flip the `it.fails` to a passing `it`. Check the sibling 2024 lane for the same shape.

## Resolution

**FIXED 2026-11-10.** Root cause confirmed exactly as filed: `applySaveMarginRider` granted `margin.also` correctly but logged a hardcoded drow-shaped sentence (`…also unconscious while poisoned (1 hour; waking on damage/shake is GM-enforced).`) for every rider row.

**Fix (data-derived prose, single template):**
1. `src/components/encounter/MonsterCardHelpers.js` — `parseSaveMarginClause` now also forwards the base clause's authored poison duration as `margin.duration` ("while poisoned IN THIS WAY" ⇒ rider lifetime == base duration). Source precedence: structured `save_effect` band first ("for 1 hour"/"for 1 minute"), falling back to the row `description` only for composite rows that author the deep band there (Homunculus "for 1 minute"). Omitted (never invented) when no `for N minute(s)/hour(s)/round(s)` text exists.
2. `src/hooks/combat/saveProcessing.js` — the rider log description is now `${target} failed the save by N (DC x, total y) — also ${margin.also} while poisoned (${duration}; ${release}).` with `duration = margin.duration || '1 hour'` (fallback = the merged clock's own rounds:600 ceiling, keeping clauseless-margin callers byte-stable) and the release advisory forked on the row's structured `context.repeatSave` key: turn-END repeat-save rows (Thri-Kreen) get "the poisoned target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success"; drow-shape rows keep "waking on damage/shake is GM-enforced". The fork copy lives in a hoisted `saveMarginRiderClauseText` helper (lint complexity cap, §45 idiom). Grant, meta stamp and the ONE merged rounds:600 clock are byte-unchanged.
3. Both call sites (`applyDamagelessSaveConditions` and the `applySaveDamage` MA-1351 leg) ride the single function, so both lanes are fixed together. There is no 2024 twin: `saveProcessing.js` is the only implementation (shared across rulesets) and a full census of `public/data/2024/*.json` shows zero `save_margin` rows. All five 5e `save_margin` rows adjudicated: Drow/Drow Elite Warrior ("1 hour", wake-shape), Pseudodragon ("1 hour", wake-shape), Homunculus ("1 minute" via description fallback), Thri-Kreen ("1 minute", repeat-save shape).

**Files changed:** `src/components/encounter/MonsterCardHelpers.js`, `src/hooks/combat/saveProcessing.js`, `src/hooks/combat/saveProcessing.save-margin-rider.test.js` (FIXME `it.fails` flipped to `it` + full pins), `src/components/encounter/MonsterCardHelpers.save-margin.test.js`, `src/components/encounter/MonsterCardModal.ma1584-thri-kreen-bite-margin.test.jsx`, `src/components/encounter/MonsterCardModal.ma1000-homunculus-bite-save-rider.test.js` (parser pins gain the data-justified `duration` field).

**Drow parity:** the drow output stays byte-identical to the pre-fix string — now locked with an exact `toBe` pin: "Bandit 1 failed the save by 10 (DC 13, total 3) — also unconscious while poisoned (1 hour; waking on damage/shake is GM-enforced)." The Thri-Kreen shape is pinned with its own exact `toBe` ("…also paralyzed while poisoned (1 minute; the poisoned target can repeat the saving throw…)") plus negative pins (no "unconscious", no "1 hour"). Test contexts now route the margin through the REAL parser (live-lane parity), so the duration pin is data-grounded.

**Verification:** red→green: flipped test first failed exactly as pinned ("…to match /paralyzed/i, received …also unconscious while poisoned (1 hour…)"). Post-fix: 6 touched files 36/36 pass; `src/hooks/combat` + `src/components/encounter` folders 627 files / 3942 pass (1 pre-existing unrelated `it.fails` expected-fail elsewhere); `npm run lint` zero warnings. LIVE faces (test-campaign, EB-joined bestiary **Thri-Kreen**, Bite save chip vs FeyRanger): pre-fix — Paralyzed applied row read "…also unconscious while poisoned (1 hour; waking on damage/shake is GM-enforced)." (fail-by-5 total 6 AND fail-by-6 total 5 rows). Post-fix — Paralyzed applied row reads "FeyRanger failed the save by 6 (DC 11, total 5) — also paralyzed while poisoned (1 minute; the poisoned target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success)."; base Poisoned applied row shape byte-unchanged (condition-only, no description); threshold honest (margin-2 fail applied Poisoned only, no rider row); runtime `activeConditions ["poisoned","paralyzed"]` with source meta. Exit: closed-tab two-pass admin clears GET-verified `{}`/`[]`; dev pair killed by PID; `git status public/campaigns/` empty.

**Adjacent (unchanged, by file scope):** the merged rider clock stays rounds:600 for ALL margin rows (pre-existing, deliberately pinned by MA-1584/MA-1000 as the one-merged-clock design) — so on the Thri-Kreen row the engine ceiling outlasts the authored 1 minute even though the log now quotes the rules honestly; adjudicating the clock itself was out of this bug's scope ("the granted condition itself is right; only the prose lies").
