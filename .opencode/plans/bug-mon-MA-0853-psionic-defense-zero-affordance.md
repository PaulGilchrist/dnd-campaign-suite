# Bug MA-0853 — Githzerai Monk / Psionic Defense: zero-affordance reaction row (FAIL(b)/DATA)

## Title
Githzerai Monk "Psionic Defense" reaction (casts Feather Fall or Shield, 2/Day) renders plain text with zero affordance — no automation authored, uses-string never renders, no gated-reaction slot

## Verdict
FAIL(b)/DATA — zero-affordance/zero-consumer twin of MA-0813/MA-0830 (§251/§240 family), with a HARDER discriminator resolved in the fix's favor: the row names two REAL spells (Feather Fall + Shield, both in BOTH spell DBs) AND `feather_fall` is already a LIVE gated-reaction effect key (MA-0006) — so the fix is a pure DATA authoring fix onto an existing live seam, not a new subsystem.

## Row (manifest)
```json
{"id":"MA-0853","monsterIndex":"githzerai-monk","monster":"Githzerai Monk","actionIndex":0,"actionName":"Psionic Defense","actionType":"other","category":"reactions","uses":"2/Day","description":"The githzerai casts Feather Fall or Shield in response to the spell's trigger, requiring no spell components and using the same spellcasting ability as Spellcasting."}
```

## Static — disk `public/data/monsters.json` githzerai-monk reactions[0] (byte-quoted)
```json
{
  "name": "Psionic Defense",
  "description": "The githzerai casts <strong>Feather Fall</strong> or <strong>Shield</strong> in response to the spell's trigger, requiring no spell components and using the same spellcasting ability as Spellcasting.",
  "spellcasting_ability": "Wisdom",
  "uses": "2/Day"
}
```
- Keys are `name`/`description`/`spellcasting_ability`/`uses` ONLY. `automation` ABSENT → `getGatedMonsterReaction()` (MonsterCardHelpers.js:1370-1372) reads `action.automation.effect` solely → null → no gated slot (§60/§205).
- `uses:"2/Day"` is a STRING on `uses`; renderer reads `formatActionUsage(action.usage)` (MonsterAction.jsx:248) → `usage` absent → NOTHING renders, not even cosmetically (§205/§240 live twin); `monsterReactionUsesRemaining` (Helpers:1375) needs numeric `maxUses`/`uses` + `automation.effect` store key → double-null.
- Row name gate: SpellCastLinks arms ONLY on row name `/^spellcasting$/i` (MonsterAction.jsx:202) — "Psionic Defense" is "other"-type → the `<strong>Feather Fall</strong>/<strong>Shield</strong>` markup renders PLAIN bold, §194/§200 fake-chip non-extension re-confirmed (zero links live).
- `spellcasting_ability` snake_case field grep-zero consumers app-wide (§200 twin).

## Spell seam (PC-side exists, monster-side does not)
- "Feather Fall" + "Shield" PRESENT in BOTH spell DBs: `public/data/spells.json` L3653/L8742 and `public/data/2024/spells.json` L5046/L11527 → PC-cast seam live (`src/services/automation/handlers/shieldHandler.js`, feather-fall PC handler).
- Monster-side: `psionic_defense`/`Psionic Defense` grep-ZERO src/+server/; no shield gate key; gate allow-list `GATED_MONSTER_REACTIONS` (Helpers:800-870) keys: `feather_fall`, `counterspell`, `hellish_rebuke`, `parry`, `split`, `heal`, `attack`, `portent`, `limited_foresight`, `elemental_absorption` — NO `shield`.
- `feather_fall` gate is LIVE but MA-0006 record-only: app has no fall-damage pipeline (Helpers:1748-1750), resolved use is advisory negation record — still a live chip+economy consumer (Aarakocra Aeromancer verified twin).

## Live probe (Playwright, fresh session, 2026-09-22, CAMPAIGN_LOCK=test-campaign)
- Header `test-campaign` verified post-select; baseline log 0, cd {}.
- EB Join Encounter (not Save, §225): exact td-text "Githzerai Monk" + exact "Bandit" (Captain/Crime Lord/Deceiver untouched); cs: idx0 "Githzerai Monk 1" (githzerai-monk, hp 38/38, AC14, init 23), idx1 "Bandit 1" (AC12); join-noise log 3 (encounter+2 roll).
- Card via avatar `img.avatar-image[alt="Githzerai Monk 1"]`; row DOM audit:
  `<div class="mc-action"><strong>Psionic Defense.</strong> <span>The githzerai casts <strong>Feather Fall</strong> or <strong>Shield</strong> …</span></div>`
  buttons: 0, diceLinks (all `.mc-dice-link*` classes): [], role=button: 0, anchors: 0, usage counter: NEVER renders, gatedChip: false.
- Row + name native `el.click()` ×2 → log delta 0 (still 3), zero Psionic/Shield/Feather entries, popups 0, console errors 0 — §194/§251 zero-delta fingerprint byte-twin MA-0813/MA-0830.
- No damage rolled, none fabricated; zero-damage/zero-affordance row needs no victim rig (§240).

## Reaction-trigger UI (codified advisory, part of same fix scope)
- The app has NO prompt-on-trigger reaction UI: gated reactions resolve ONLY via GM chip press (`handleGatedReaction`, MonsterCardModal.jsx:1966, arms only when `getGatedMonsterReaction` non-null). Absence of an automatic "react to falling spell / Shield trigger" prompt is codified advisory (§200/§251 + MA-0006 record-only note Helpers:1748) — advisory, not an additional FAIL axis; it rides the same fix as gate-key authoring.

## Fix (DATA onto live seam)
1. Author on githzerai-monk reactions[0] the MA-0006 Aarakocra byte-shape:
   `automation: {type:"reaction", trigger:"falling", effect:"feather_fall"}` + numeric `uses:2`+`maxUses:2` + `usage:"2/Day"` (keep existing keys; §169/§240 numeric-uses rule; MA-0648 template family for usage gating).
2. Feather-Fall half rides the live record-only gated consumer (chip "Feather Fall (2 left)", round latch + `feather_fall_refused`, MA-0006/MA-0725 lineage). Shield half: RAW choose-one — either add a `shield` gate key (lastAttack spell-target identity, parry MA-0341 lineage) or log the choice as advisory record in the resolver popup (MA-0399 split instruction precedent); "or" choose-one = §65/MA-0275 chooser precedent if adjudicated as chooser, else record-only instruction text.
3. Family twins same shape: githzerai-zerth reactions[0] (uses "2/Day"), githzerai-psion reactions[0] (no uses = RAW unlimited, MA-0341 At-Will sentinel `usage:"At Will"`+`uses:999`); quaggoth-thonot reactions[0] has prose `trigger` only (separate ticket scope).

## Regression test target
- Extend `MonsterCardHelpers` gated-reaction tests (portent/limited-foresight test twins) pinning `getGatedMonsterReaction(githzeraiRow)` non-null + numeric uses gate; MA-0725 hellish-rebuke stale-pin inversion pattern (§216/§236) if any test pins the row null.

## Cleanup
- Admin clear test-campaign log + change-data, verify log:[] cd:{}.
