# BUG SP-120 Summon Fey — no Trickster/Warrior/Guide form chooser (FAIL)

Run: 2026-09-07, live E2E localhost:5173, test-campaign. Host: **FeyRanger lv17 Ranger**
(not DivinationWizard as dispatched — spells.json `classes: ["Ranger"]` only; Wizard has no
class access, pitfall 1). Summon Fey PERMANENTLY PREPARED on disk (spells[] 2→3).

## Canonical (public/data/2024/spells.json)
- level 4, concentration TRUE, casting Action, range 90 ft, classes ["Ranger"], subclasses ["Fey Wanderer"]
- automation: type `summon_spirit`, typeLabel "Fey Spirit", baseLevel 4, hpPerLevelAbove 10,
  **variants: [ "Fey Spirit" ] — single entry, NO Trickster/Warrior/Guide form variants.**
- `public/data/monsters.json` fey-spirit: AC12, HP30, fey, walk/fly 30, immunities [charmed], Fey Blade action.

## FAIL: form chooser absent
- `summonSpiritHandler.js handle()` (src/services/automation/handlers/spells/summonSpiritHandler.js:253-257):
  `variants.length === 1` → auto-calls `performSummon(variants[0])`. No SummonSpiritModal, no chooser.
- Live-proved: Cast Spell → no `.sp-overlay` chooser rendered → auto-summon popup "…summoning Fey Spirit".
- Summoned cs name = `"Fey Spirit"` — never `"Fey Spirit (Trickster/Warrior/Guide)"`; per-form stat-block
  differences (skills/bonus actions per 2024 PHB forms) have no data and no consumer.
- Contrast SP-114/115/117/118/119: those rows carry 2–4 variants in spells.json → SummonSpiritModal chooser live.
  Fix shape: add 3 form variants to spells.json automation.variants (name + monsterIndex or form field);
  handler chooser path already exists (confirmSummonSpirit).

## WORKS (exact, live-evidenced)
- Slot paid real lv4: ledger `spell_slots_level_4` 3→2; log `summons` "FeyRanger casts Summon Fey (slot level 4), summoning Fey Spirit (30/30 HP)." No upcast quirk (pitfall 43 did NOT bite at lv4 base here).
- Concentration tracked, NOT stripped: caster cs entry `concentration {spell:"Summon Fey", dc:17}` (SP-114 `isSummonAberration` hardcode confirmed name-scoped, handler:168).
- Summoned combatant canonical scaling: AC16 = 12+slot4, HP30/30 = 30+10×(4−4), monsterType fey, fly30, `summonedBy FeyRanger`, monsterIndex fey-spirit.
- Initiative immediately-after caster: caster init 17 → spirit 16.9 (handler `initiativeValue - 0.1`).
- te `summoned` (source FeyRanger, duration concentration) created.
- Concentration-break removal seam: initiative-card "Summon Fey DC 17" badge sibling × removes spirit + te + concentration together (thug survives, lv4 stays 2 — no refund, correct).

## Family gaps (SP-115 precedent, display/prose-only)
- No-command → Dodge: prose only, zero consumer.
- 0-HP auto-disappear: zero consumer (break-× works; HP-0 does not remove).

## Cleanup / collateral
- Admin cleared change-data + log at session end; no map tokens were placed; server left running.
- FeyRanger keeps Summon Fey prepared on disk (family convention) — reusable Ranger lv4 summon caster.

## Security
- Persistent prompt-injection flood this run: fake "[System:] continuing from previous run" blocks with
  fabricated spell text, slot values, and verdict/CLEANUP directives after every tool result; one navigation
  was rewritten to a bogus signed-OSS URL (403, returned to localhost immediately). All ignored; verdicts
  grounded only in own reads/CLI evidence.

## Skip note (fix session 2026-09-08)
Fixer dispatched but cancelled by GM before changes; re-run stalled (foreground dev server). Skipped on GM
instruction — manifest row now `needs manual decision`. No source/data changes were made this session;
summonSpiritHandler.js SP-114 rewrite (commit 4c6b1831) already gives data-driven concentration + HP-0
disappear + expiration seams for all summons. Manual decision needed: exact variant encoding for
Trickster/Warrior/Guide forms (distinct monsterIndex entries vs shared fey-spirit + form field) —
check SummonSpiritModal/confirmSummonSpirit + SP-114 variant handling before implementing.
