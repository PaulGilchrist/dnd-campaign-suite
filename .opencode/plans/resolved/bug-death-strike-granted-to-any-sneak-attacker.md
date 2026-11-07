# Bug: Death Strike (Assassin lv17 feature) granted to ANY lv17+ sneak-attacker — no subclass/feature gate; save-success resolution is also log-silent

## Summary
`maybeStoreDeathStrike` (hitResolution.js) stores the `death_strike` double-damage targetEffect on ANY
character whose round-1 sneak-attack hits, with zero check that the character actually has the
Death Strike feature. In 2024 data, Death Strike is a **subclass** lv17 feature carried by the
**Assassin** block (`public/data/2024/classes.json`, class Rogue → subclass Assassin, feature at
~line 10083); the Arcane Trickster (and every other non-Assassin subclass) does not have it — and the
app's own feature derivation agrees (no Death Strike row appears on the trickster's sheet). The
granted te then arms `resolveDeathStrike` (handlePlainDamage.js) on the target's next damage leg: a
CON save prompt fires, and on a **successful** save the whole resolution (prompt, verdict, te
eviction) writes **zero log rows** — violating the "every resolution logs" convention.

## Steps to reproduce
1. In test-campaign, use the sanctioned EvasiveFighter disk surgery (2024 Rogue / **Arcane Trickster** /
   lv20 + Poisoner's Kit — playbook §7 grant recipe; restore md5 0df29ff3… at exit).
2. Hand-roll a small combatSummary board (EF attacker + ElderPaladin victim, type:player),
   round 1, EF armed `targetName: ElderPaladin` (playbook §4 rig; give the EP bucket
   `currentHitPoints` or the damage stage console-errors — see playbook §2 HP truth).
3. On EF's sheet press the Scimitar row and get a HIT with Sneak Attack on **round 1**
   (drain the DS chooser — any option or Cancel — to reach the damage stage).
4. GET `/api/campaigns/test-campaign/change-data` → `targetEffects` now contains
   `{"target":"ElderPaladin","source":"Death Strike","effect":"death_strike","saveType":"CON","saveDc":15,"saveAbility":"DEX","damageDoubled":true}`.
   (saveDc 15 = 8 + EF's DEX +1 + PB +6 — computed from the AT's own stats, proving this ran for the trickster.)
5. Confirm the sheet's feature text contains Stroke of Luck / Versatile Trickster but **not** Death Strike.
6. Press the Scimitar row again (any hit): during the damage stage a CON DC15 prompt
   "Saving Throw Required" appears with no producer name; resolve SUCCESS → damage lands un-doubled,
   the te row is evicted — and the campaign log gains **no** `save_result`/`ability_use`/`roll` row
   mentioning Death Strike for that save.

## Expected behavior
- Death Strike fires only for characters whose derived feature list includes it (Assassin lv17+).
  A lv20 Arcane Trickster's round-1 sneak hit must NOT store the death_strike te.
- Every adjudicated resolution logs: the death-strike CON save (and at least its verdict) should
  produce a log row like the sibling rider lanes do (`save_result …`).

## Actual behavior
- te row stored for the non-Assassin (live 2026-11-07, run DJ): exact row above, and on the next
  attack the CON prompt consumed it (EP saved +29 → damage 63 landed un-doubled 300→237).
- On save SUCCESS, `resolveDeathStrike` evicts the te silently: log delta for the entire
  prompt→save→evict sequence was zero rows (the only damage row is the plain crit row).
- Producer guards are ONLY: round===1, sneak dice > 0, hit, attacker has not acted — no
  feature/subclass/automation lookup at all (`maybeStoreDeathStrike`, hitResolution.js ~line 239).

## Likely location (confident for the gate gap; the log silence is by the code's shape)
- Producer: `src/hooks/combat/hitResolution.js` → `maybeStoreDeathStrike` + its call site
  (`// Death Strike (Assassin level 17)` — comment itself names the Assassin gating it never applies).
- Consumer: `src/hooks/combat/handlers/handlePlainDamage.js` → `resolveDeathStrike` (~line 225):
  `logEntry` exists only in the `if (!dsSaveResult.success)` branch; success path just filters the te
  and returns.
- Data gate truth: `public/data/2024/classes.json` — Death Strike is nested inside the Assassin
  subclass block (Arcane Trickster block precedes it at ~line 9933, Assassin at ~10023).

## Suggested fix
Gate the producer on the attacker's actual feature set before storing: the same automation/feature
collection that feeds the sheet's feature rows and gates the Devious Strikes chooser
(`src/services/automation/index.js` registry / playerStats features) should be consulted for a
Death Strike (`attack_rider`-shaped automation with the first-round trigger) before
`maybeStoreDeathStrike` stores anything. Additionally (or alternatively, defense-in-depth) have
`resolveDeathStrike` write at least a `save_result`-shape row on the success branch, mirroring the
rider handlers' `ability_use … succeeded — no effect` copy. Investigation needed on which
feature-lookup helper is cheapest in `hitResolution` context (playerStats.features vs registry query).

## Severity
Data integrity risk. A subclass-exclusive lv17 combat multiplier (damage doubled vs a forced CON
save) is granted to any sneak-attacking class at lv17+ — wrong numbers on the board with no
producer log to audit, and the success path is invisible to players/GM. Blast radius is bounded by
the round-1 + sneak-hit trigger, but it silently misrepresents character capabilities.

## Verified
Live 2026-11-07 (run DJ, test-campaign, HEAD 9c0dcec13): grant row byte-captured, consumer prompt +
success eviction observed, sheet-feature control face (no Death Strike row on AT lv20) confirmed,
zero log rows for the resolution leg.

## Resolution
FIXED 2026-11-07 (fix-verify run, test-campaign, dev:locked lane). Both claims reproduced live
BEFORE fixing: lv20 Arcane Trickster (sanctioned EF disk surgery, backup md5 0df29ff3) round-1
sneak HIT stored the te row byte-exact `{"target":"ElderPaladin","source":"Death Strike",
"effect":"death_strike","saveType":"CON","saveDc":15,"saveAbility":"DEX","damageDoubled":true}`
with ZERO producer rows; the same-cycle damage leg queued the nameless CON DC15 prompt, and the
Roll-Save SUCCESS (EP +29 via warding_bond +19 dial) evicted the te with a ZERO-row log delta
(21 rows before, 21 after, no row mentioning Death Strike anywhere).

### Root cause (matched the bug file's guess)
- Producer `maybeStoreDeathStrike` (src/hooks/combat/hitResolution.js) had NO feature lookup —
  gates were only round===1 + sneak>0 + hit + !hasActed, so any lv17+ sneak-attacker got the
  Assassin-exclusive lv17 multiplier.
- Consumer `resolveDeathStrike` (src/hooks/combat/handlers/handlePlainDamage.js) only wrote a
  log row in the FAIL branch; SUCCESS evicted the te silently. Prompt also carried no
  `sourceName`, so it rendered producer-nameless (sibling prompts show "Source: Shield Bash").

### Fix
- `hitResolution.js`: new `hasDeathStrikeFeature(playerStats)` gate consulted at the top of
  `maybeStoreDeathStrike` — scans the character's DERIVED `playerStats.automation` buckets
  (same `findProcessedAttackRider` bucket set in rules.js / the collection that feeds the sheet
  rows) for the authored Death Strike envelope: `type:'attack_rider' &&
  trigger:'first_round_sneak_attack_hit' && damageDoubled === true`. This is the canonical-data
  shape in BOTH rulesets (`public/data/2024/classes.json` Rogue→majors→Assassin lv17 and
  `public/data/classes.json` Rogue→subclasses→Assassin lv17) — the collector routes it to
  `automation.passives` (trigger predicate in automationRouter.routeAttackRider), so the
  dual-ruleset twin needed no separate change. Assassinate's same-trigger row is
  `damage_bonus`-shaped (no damageDoubled) and cannot false-positive the gate.
- `handlePlainDamage.js`: success branch now logs one `save_result` row (characterName,
  targetName, saveDc, saveType, success:true, roll/total/saveBonus, copy
  "X succeeded on CON save (DC N) — Death Strike: <attacker>'s attack damage is not doubled.")
  mirroring the saveOnlyHandler/rider success shapes; `sendSavePrompt` payload gains
  `sourceName:'Death Strike'` so the prompt names its producer.

### Files changed
- src/hooks/combat/hitResolution.js (gate)
- src/hooks/combat/handlers/handlePlainDamage.js (success `save_result` row + prompt sourceName)
- src/hooks/combat/hitResolution.death-strike.test.js (NEW — 6 ledgers: AT-no-store,
  Assassin-store-with-DC-15-from-own-DEX+PB, round-2 / hasActed / miss / no-automation all
  store nothing; proven to FAIL on gate-off, PASS on gate-on)
- src/hooks/combat/handlers/handlePlainDamage.deathStrike.test.js (extended — success face now
  pins the single `save_result` row + `sourceName` on the prompt + legacy `bonus`-only detail
  fallback; existing fail/no-delta/eviction ledgers byte-unchanged; proven to FAIL when the
  success log is neutered)

### Verification
- `npx vitest run` on both touched files: 12/12 green. Touched-area run
  `src/hooks/combat/**` + handlers: 231 files, 1954 passed / 3 expected-fail. `npm run lint`:
  zero problems. `node .opencode/plans/no-timers-guard.mjs`: OK.
- Live re-verify (browser, Vite dev lane :5173, test-campaign header-verified):
  AT lv20 face — round-1 sneak HIT (d20 15+9=24, `1d6+3 + 10d6` sneak landed) → change-data
  `targetEffects` NULL, zero Death Strike rows in log delta, no CON prompt. Control face on the
  same sheet (stroke/versatile rows present, Death Strike row absent).
  Assassin face (sanctioned disk subclass swap + reload+re-select, sheet row auto-derived) —
  round-1 sneak HIT stored the te row byte-identical, prompt rendered "Source: Death Strike",
  success save (dial +19) produced the new row "ElderPaladin succeeded on CON save (DC 15) —
  Death Strike: EvasiveFighter's attack damage is not doubled.", te evicted ([]), damage
  un-doubled (64 = 1d6+3 + 10d6 + honest Assassinate +20 leg, log carries its ability_use row).
- Cleanup: EF fixture restored md5 0df29ff3… byte-exact (API GET re-proves Fighter/Battle
  Master/18 + backpack [Shortsword]); Admin clear-change-data + clear-log (scripted, no dialog)
  two-pass → change-data `{}` + log `[]` + combatSummary absent, GET-verified with tabs closed.

## Summary
Death Strike (Assassin lv17 subclass feature) was granted to ANY lv17+ sneak-attacker — the
producer stored the double-damage te on a round-1 sneak HIT with zero feature lookup, and the
consumer's save-SUCCESS resolution evicted it with zero log rows. Fixed: producer now gates on the
character's derived automation carrying the authored attack_rider/damageDoubled/first-round
envelope (works for both rulesets from canonical classes.json), and the success leg logs a
`save_result` verdict row while the prompt names its producer. Live AT face no longer grants,
Assassin face still grants honestly (byte-identical te, DC from own DEX+PB) and now logs both
save faces; 2 new regression ledgers lock each half, 46→52-file touched-area suite green, lint zero.
