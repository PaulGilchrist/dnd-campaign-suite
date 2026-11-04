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
