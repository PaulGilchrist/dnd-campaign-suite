# Bug MA-0857 — Githzerai Psion / Psionic Defense: zero-affordance reaction row (FAIL(b)/DATA)

## Title
Githzerai Psion "Psionic Defense" reaction (casts Feather Fall or Shield, RAW unlimited) renders plain text with zero affordance — no automation authored, no uses key at all (thinner than MA-0853 twin), no gated-reaction slot

## Verdict
FAIL(b)/DATA — byte-twin of MA-0853 (githzerai-monk Psionic Defense, .opencode/plans/bug-mon-MA-0853-psionic-defense-zero-affordance.md) §251/§70 family; ONLY structural diffs here: `uses` key ABSENT entirely (RAW unlimited — MA-0853 had at least the inert string `uses:"2/Day"`) and `spellcasting_ability:"Intelligence"` (psion INT caster vs monk WIS). Both diffs make the row strictly THINNER — even less cosmetic surface, same zero-affordance/zero-consumer fingerprint.

## Row (manifest)
```json
{"id":"MA-0857","monsterIndex":"githzerai-psion","monster":"Githzerai Psion","actionIndex":0,"actionName":"Psionic Defense","actionType":"other","category":"reactions","description":"The githzerai casts Feather Fall or Shield in response to the spell's trigger..."}
```

## Static — disk `public/data/monsters.json` githzerai-psion reactions[0] (byte-quoted)
```json
{
  "name": "Psionic Defense",
  "description": "The githzerai casts <strong>Feather Fall</strong> or <strong>Shield</strong> in response to the spell's trigger, requiring no spell components and using the same spellcasting ability as Spellcasting.",
  "spellcasting_ability": "Intelligence"
}
```
- Keys `name`/`description`/`spellcasting_ability` ONLY vs MA-0853 (name/description/spellcasting_ability/`uses:"2/Day"`). Diff: `uses` ABSENT (RAW unlimited, §70 honest sentinel target `usage:"At Will"`+`uses:999`); ability Intelligence vs Wisdom.
- `automation` ABSENT → `getGatedMonsterReaction()` (MonsterCardHelpers.js:1370) reads `action.automation.effect` solely → null → no gated slot (§60/§205); gate allow-list `GATED_MONSTER_REACTIONS` (Helpers:800) has `feather_fall` LIVE (MA-0006 record-only), NO `shield` key.
- `formatActionUsage(action.usage)` (MonsterAction.jsx:248, rendered :271) → `usage` absent AND no `uses` string → counter NEVER renders, not even cosmetically (§205/§240/§681 fingerprint, strictly thinner than MA-0853).
- Row-name gate `/^spellcasting$/i` (MonsterAction.jsx:247) — "Psionic Defense" ≠ Spellcasting → `<strong>Feather Fall</strong>/<strong>Shield</strong>` render PLAIN bold, §194/§200 fake-chip non-extension.
- `"Psionic Defense"|psionic_defense` grep-ZERO src/+server/ (exit 1 today); `spellcasting_ability` monster-row field grep-zero consumers (prod hits = PC-side spellAbilities/cantrip features + test assertions only) — §200 twin.

## Live probe (Playwright, fresh session, 2026-09-22, CAMPAIGN_LOCK=test-campaign)
- Header `test-campaign` verified post-select; href localhost:5173 re-verified every evaluate; baseline log 0, cd {}.
- EB Join Encounter (not Save, §225): search "Githzerai Psion" exact row cb → filter "Bandit" via native value-setter+input event → exact td-text "Bandit" cb only (Captain/Crime Lord/Deceiver untouched); checked audit = ["Bandit","Githzerai Psion"] exactly.
- cs dump: idx0 "Githzerai Psion 1" (githzerai-psion, hp 169/169, AC18, init 24); idx1 "Bandit 1" (bandit, AC12); party placeholders idx2+ (§93); round 1. Join-noise log 3 (encounter + 2 roll).
- Card via avatar `img.avatar-image[alt="Githzerai Psion 1"]`; row DOM audit:
  `<div class="mc-action"><strong>Psionic Defense.</strong> <span>The githzerai casts <strong>Feather Fall</strong> or <strong>Shield</strong> …</span></div>`
  buttons: 0, `.mc-dice-link*`: [], role=button: 0, anchors: 0, usage counter: NEVER renders, gatedChip: false. Card-wide chip audit shows chips ONLY on attack/save/skill/Spellcasting rows (`mc-dice-link-spell Mage Hand` present — gate is row-name-scoped, §194 non-extension re-live).
- Row+name native `el.click()` ×2 → log delta 0 (3→3), zero Psionic/Shield/Feather entries, overlays open 0, console errors 0 — §194/§251 zero-delta fingerprint byte-twin MA-0853/MA-0813/MA-0830.
- No damage rolled, none fabricated; zero-affordance row needs no victim rig (§240).

## Fix (DATA onto live seam — thinner than MA-0853)
1. Author on githzerai-psion reactions[0]: `automation:{type:"reaction",trigger:"falling",effect:"feather_fall"}` + At-Will sentinel §70/§60: `usage:"At Will"`, numeric `uses:999`+`maxUses:999`, 1/round latch (MA-0006/0300/0305 lineage) — uses key absent today, so fix ADDS numeric-uses fields (vs MA-0853's convert-string-shape); keep `spellcasting_ability:"Intelligence"` (or drop, zero consumer).
2. Feather-Fall half rides live record-only gated consumer (`feather_fall` chip "Feather Fall (999 left)" + round latch, MA-0006/MA-0725). Shield half: add `shield` gate key (parry MA-0341 lineage) or advisory choice-record (§275 chooser precedent) — same MA-0853 fix item 2, shared work.
3. Family: githzerai-zerth reactions[0] (uses "2/Day") + this psion row (no uses) — same pass per MA-0853 fix item 3.

## Regression test target
- MonsterCardHelpers gated-reaction suite: pin `getGatedMonsterReaction(githzeraiPsionRow)` non-null + At-Will numeric-uses gate (portent/limited-foresight twins); MA-0725 stale-pin inversion check (§216/§236).

## Cleanup
- Admin clear test-campaign log + change-data, verify log:[] cd:{}. test-campaign only; no manifest/git.
