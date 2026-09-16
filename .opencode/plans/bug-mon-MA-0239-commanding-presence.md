# BUG MA-0239 — Ancient Red Dragon "Commanding Presence" (legendary) — inert prose

**VERDICT: FAIL** (inert + zero-delta; MA-0228/0219/0196/0208/0238 fingerprint confirmed live)

## Evidence

### Static (STEP 1)
- `public/data/monsters.json` ancient-red-dragon `legendary_actions[1]` = bare `{name, description}` only — NO `attack_bonus`/`save_dc`/dice/`delegates_to`/`automation`.
- Header `legendary_actions[0]` ("Legendary Action Uses: 3 (4 in Lair)") carries NO numeric `uses` → `legendaryHeaderAction()` (src/services/encounters/monsterLegendaryUses.js:153) returns null → `LegendarySpendLink` (src/components/encounter/MonsterAction.jsx:148) null → per-row affordance + counter never rendered (MA-0219 recipe).
- Consumer grep: only authored `delegates_to` resolves a legendary to a live mechanic (monsterLegendaryUses.js:7; MonsterCardModal.jsx:253/304). NO parser converts "uses Spellcasting to cast Command (level 2 version)" prose into a roll.

### Live (STEP 3)
- EB exact "Ancient Red Dragon" → tick → Join Encounter; init 6, AC 22, HP 507; dragon target armed ElderPaladin (curl-verified `targetName`).
- Row outerHTML dump: `<div class="mc-action"><strong>Commanding Presence.</strong> <span>The dragon uses Spellcasting to cast <em>Command</em> (level 2 version). …</span></div>` — **0 `.mc-dice-link`, 0 buttons, 0 `[role=button]`**; `.mc-legendary-counter` 0; no "Expend Legendary" chip.
- Click on row: **zero delta** — log stayed 2 entries, no popup/save prompt, `monsterLegendaryUses` never created. Once-per-turn gate also unreachable (no affordance).

### Control (STEP 4) — live path proven different
- Same card, non-legendary Spellcasting row renders live chips (Command / Detect Magic / Scorching Ray / Fireball 1-Day / Scrying 1-Day).
- Click Command chip → log 2→3: `ability_use` "Ancient Red Dragon 1 casts Command via Spellcasting. Spell effect is recorded; GM-enforced for monsters." (ts 1789522196993).

## Likely Location
- `src/components/encounter/MonsterCardBody.jsx` legendary block (plain-`mc-action` fallback branch for non-numeric legendary rows) + `src/components/encounter/MonsterAction.jsx` (`LegendarySpendLink` gated on header `uses != null`) + `src/services/encounters/monsterLegendaryUses.js` (`legendaryHeaderAction`).
- Root = **DATA authoring** in `public/data/monsters.json` ancient-red-dragon.

## Fix shape (per MA-0219/0185 pattern)
- Header `legendary_actions[0]`: add numeric `uses: 3`.
- Row `legendary_actions[1]` Commanding Presence: add `delegates_to: "Spellcasting"` (verbatim name match) so the cast-prose routes through the live Spellcasting cast branch (Command lv2, DC 23), or inline auto_attack/spell metadata.
- Sibling `legendary_actions[2]` Fiery Rays (Scorching Ray lv3) shares the same fingerprint — fix together.

## Cleanup
- Admin "Clear Change Data" + "Clear Campaign Log" (test-campaign) accepted; verified log `[]`, change-data `{}`.
