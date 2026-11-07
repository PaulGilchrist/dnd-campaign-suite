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
