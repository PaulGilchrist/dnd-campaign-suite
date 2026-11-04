# Wolf gridless lenient face prints unmeasured "within 5 ft" claim in Adv chip

## Summary
On the PC roller lane with **no active map**, the Wolf rage aura leniently grants Advantage (house-law §44, correct) but the popup chip and log `advantageReason` read `Wolf rage aura — enemy of raging <bearer> within 5 ft` — asserting a proximity that was never measured. The lion and corona sync-lane twins were fixed in commit 2cd75b9de to fork their reason copy (`… — proximity unmeasured (gridless) — GM-enforced`) exactly for this honesty problem; `resolveWolfAura` was left "untouched" by 54d2ee840 + 2cd75b9de and still hardcodes the measured prose on BOTH faces.

## Steps to reproduce
1. In test-campaign, ensure a Winged Kobold is in initiative (Encounters → search "Winged Kobold" → checkbox → Join Encounter) and the browser tab has NO active map (Maps manager → deactivate, or `POST /api/campaigns/test-campaign/__map__ {value:{activeMapName:null}}` and wait for SSE adoption).
2. Stamp a wolf buff on a party member other than the roller: `POST /api/campaigns/test-campaign/DraconicDragon {value:{activeBuffs:[{name:'Rage of the Wilds',optionName:'Wolf',source:'Power of the Wilds',grantedAt:<now>}]}}`.
3. On EvasiveFighter's card select "Winged Kobold" as target; press the Glaive "+9" cell twice (first press may consume a Studied Attacks one-shot after a prior miss — see playbook).
4. Read the result popup chip and the newest `roll` log entry.

## Expected behavior
Gridless (unmeasured) face names the aura and admits GM-enforcement, mirroring the lion twin: e.g. `Adv (Wolf rage aura — enemy of raging DraconicDragon — proximity unmeasured (gridless) — GM-enforced)`.

## Actual behavior
Chip prints `Adv (Wolf rage aura — enemy of raging DraconicDragon within 5 ft)` and the log entry carries `advantageReason:"Wolf rage aura — enemy of raging DraconicDragon within 5 ft"` while `__map__.activeMapName === null` — byte-identical to the honest measured face (verified live 2026-11-04: measured face at bearer↔target 5 ft prints the same string; gridless face at tokenless/inactive-map prints the same string; control with the stamp stripped = `mode:"normal"`, zero chip). No distance was ever compared on the gridless face.

## Likely location
Confident: `resolveWolfAura` in `src/services/automation/contextBuilder-sync.js` (~line 390) builds the reason unconditionally:
`return wolf.advantage ? { mode: 'advantage', reason: 'Wolf rage aura — enemy of raging ' + wolf.source + ' within 5 ft' } : undefined;`
It never branches on the `skipRangeCheck` value it just computed via `auraSkipRangeCheck()`. `resolveDuplicityAura` reason ('Improved Duplicity') has no distance claim, so it's unaffected.

## Suggested fix
Mirror `resolveLionAura` (same file, added in 2cd75b9de): hoist `const skip = auraSkipRangeCheck();` and fork the reason — measured: current string; lenient: `Wolf rage aura — enemy of raging ${wolf.source} — proximity unmeasured (gridless) — GM-enforced`. Extend the pins in `contextBuilder-sync.wolf-aura.test.js` + `DiceRollResult.rendering.test.jsx`.

## Severity
Minor UX issue / log-copy honesty — the MODE is correct; only the attribution prose overclaims a measurement. Same class as 3db9da635 (lion log) and 2cd75b9de (lion/corona chip), which the project explicitly treats as worth fixing.

## Resolution
FIXED 2026-11-04. The diagnosis in "Likely location" was confirmed exactly: `resolveWolfAura` in `src/services/automation/contextBuilder-sync.js` hardcoded `… within 5 ft` on both faces, never branching on the `skipRangeCheck` value it computed via `auraSkipRangeCheck()` (the lion twin `resolveLionAura` got that fork in 2cd75b9de; wolf was skipped).

### Changes
- `src/services/automation/contextBuilder-sync.js` — `resolveWolfAura`: hoisted `const skipRangeCheck = auraSkipRangeCheck();` and forked the reason mirroring `resolveLionAura` byte-for-byte in shape — measured face keeps `Wolf rage aura — enemy of raging ${wolf.source} within 5 ft` (byte-identical); lenient face prints `Wolf rage aura — enemy of raging ${wolf.source} — proximity unmeasured (gridless) — GM-enforced`.
- `src/services/automation/contextBuilder-sync.wolf-aura.test.js` — gridless pin updated to the honest tail (this pin had been LOCKING the buggy string); near-face (active map) pin extended to pin the measured `within 5 ft` reason (mirrors the lion measured-face pin).
- `src/components/char-sheet/DiceRollResult.rendering.test.jsx` — added a pin that the wolf lenient reason prints under the `Adv (` prefix with the GM-enforced tail verbatim (mirrors the corona face). The existing pre-fix render test needed no change (string-agnostic pass-through pin).
- Dual-ruleset check: no 2024 twin exists for this producer — grep shows the ONLY `"Wolf rage aura"` producer app-wide is `contextBuilder-sync.js:resolveWolfAura`; `resolveDuplicityAura`'s reason ('Improved Duplicity') carries no distance claim and stays untouched. Monster lane: `resolveMonsterLionAura`/`buildLionAuraReason` were already forked (3db9da635); no wolf monster-lane reason producer exists.

### Verification
- Live repro BEFORE fix (test-campaign, EB-joined Winged Kobold, `__map__` null, DD wolf-buff stamp, EF glaive +9): chip `Adv (Wolf rage aura — enemy of raging DraconicDragon within 5 ft)`, log `mode:"advantage", advantageReason:"… within 5 ft"` — bug confirmed.
- Live re-verify AFTER fix (vite HMR, tab reload, same gridless rig): chip `Adv (Wolf rage aura — enemy of raging DraconicDragon — proximity unmeasured (gridless) — GM-enforced)`, log entry carries the same honest tail, 2d20 advantage math unchanged.
- MEASURED face sanity (battle-arena rig: DD@(5,5) player token, Kobold@(5,6) placedItem = 5 ft bearer↔target, EF roller token placed; API activate, client adopted `__map__` with zero reload): chip + log print `Wolf rage aura — enemy of raging DraconicDragon within 5 ft` byte-identical, `isAutoMiss:false`.
- Lion twin sanity (DD stamp stripped, EP defector bucket `{activeBuffs Lion + selectedAllies [EP,DD,FR]}` single merged POST, map deactivated): gridless press still prints `Disadv (Lion rage aura — enemy of raging ElderPaladin — proximity unmeasured (gridless) — GM-enforced)` with honest 2d20-lowest (8,18→8).
- Tests: `contextBuilder-sync.wolf-aura.test.js` 10/10; `DiceRollResult.rendering.test.jsx` 39/39; touched-lane run (vitest filters `src/services/automation` + `src/components/char-sheet`) 1057 files / 12,330 tests ALL PASS; `npm run lint` zero warnings; `no-timers-guard` OK.
- Cleanup: battle-arena byte-restored from dist (md5 94fcd0bf…), tab closed, closed-tab two-pass admin clear via API (`clear-change-data` + `clear-log`) verified `{}`/`[]`/cs-null twice; zero `campaign-lock` denials in dev log; `git status` shows only the three source/test files above.
