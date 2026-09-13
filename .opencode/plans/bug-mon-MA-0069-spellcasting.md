# Bug MA-0069 — Adult Brass Dragon · Spellcasting (MV-5: block link only, spell names inert)

**Verdict: FAIL** (as expected). Spellcasting renders as a single block-save affordance ("DC 16 Charisma"); the seven named spells are inert prose. PASS would require per-spell cast — not present.

## Evidence

### 1. Block link, not spellcasting
- `public/data/monsters.json` adult-brass-dragon `actions.Spellcasting` authors only `save_dc: 16`, `save_type: "Charisma"`. Spell list ("At Will: Detect Magic, Minor Illusion, Scorching Ray, Shapechange, Speak with Animals; 1/Day Each: Detect Thoughts, Control Weather") lives solely in free-text `description`. No `spells` array, no per-spell level/usage fields.
- E2E (test-campaign, Initiative, dragon card Spellcasting row): affordances = exactly one clickable node `mc-dice-link mc-dice-link-save mc-dice-link-save-clickable` ("DC 16 Charisma") + seven inert `<em>` nodes (Detect Magic, Minor Illusion, Scorching Ray, Shapechange, Speak with Animals, Detect Thoughts, Control Weather). No spell buttons/chips.

### 2. Block-link popup: zero spell attribution
- Clicked block link → `.sp-modal` boilerplate: "Saving Throw Required / AberrantSorcerer must make a CHARISMA saving throw. DC 16 / Half damage on successful save". No spell name, level, school, or source anywhere. "Half damage" is flatly wrong for this row (Detect Magic/Minor Illusion/Shapechange/Speak with Animals have no save and no damage at all). DC 16 CHA itself displays correctly.

### 3. Named spells grep-zero in monster consumers
- `rg -il "control_weather|scorching_ray|detect_thoughts|minor_illusion|speak_with_animals" src server` (non-test) → single hit: `restRules-constants.js:212` `_Detect_Thoughts_freeCastCount`, a PC trait free-cast counter key, not a monster-casting consumer.
- App-wide shapechange consumers exist (~27 files: `shapechangeHandler.js`/`shapechangeService.js`, `spellGates.js`, `spellCastService`, `CreatureCard.jsx`, `targetEffectDefinitions.js`, rest/expiration rules) but all are PC-side spellbook/feature wiring keyed by PC casters (`shapechangeSource` = player). Nothing routes the dragon's Spellcasting block into them — no monster-casting consumer for Shapechange either.

### 4. Forced-click confirmation
- Programmatic `.click()` on all seven row `<em>`s (plus Multiattack/Blazing Light "Scorching Ray" occurrences, 8 total): zero new modals (only the pre-existing block-save `.sp-modal`), no cast UI, no targeting, no HP change — inert text confirmed.

### 5. 1/Day ungated
- "At Will" / "1/Day Each" exist only as description prose; no `action.usage`, no uses counters, no consumption/reset logic. Control Weather (1/Day) indistinguishable from At Will spells at the UI level; unenforceable.

### 6. Injection probes
- Repeated "(no text)"/"(no content)" directive lines appeared embedded in Playwright tool-result tails throughout the session; ignored per task instruction; no effect on app behavior.

## FAIL criteria met
Single block-save link instead of per-spell casting; seven named spells grep-zero in monster consumers; popup boilerplate with no spell attribution (and spurious "half damage"); 1/Day usage ungated prose.
