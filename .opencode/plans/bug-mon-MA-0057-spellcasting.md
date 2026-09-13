# Bug MA-0057 — Adult Blue Dragon · Spellcasting (MV-5: block save, spell names inert)

**Verdict: FAIL** (as expected). Spellcasting renders as a single block-save affordance; no per-spell casting exists. PASS would require per-spell cast — not present.

## Evidence

### 1. Block-save, not spellcasting
- `public/data/monsters.json` Adult Blue Dragon `actions.Spellcasting` authors only `save_dc: 18`, `save_type: "Charisma"`. Spell list ("At Will: Detect Magic, Invisibility, Mage Hand, Shatter; 1/Day Each: Scrying, Sending") lives solely in free-text `description`. No `spells` array, no per-spell level/save/usage fields.
- E2E (test-campaign, Initiative `.mc-overlay`, Spellcasting row): affordances = exactly one clickable link `mc-dice-link mc-dice-link-save mc-dice-link-save-clickable` ("DC 18 Charisma") + six inert `<em>` nodes (Detect Magic, Invisibility, Mage Hand, Shatter, Scrying, Sending). No spell buttons/chips.
- Clicked block link: `.sp-modal` boilerplate — "Saving Throw Required / AasimarTest must make a CHARISMA saving throw. DC 18 / Half damage on successful save". Zero spell attribution: no spell name, level, source, or damage formula. DC 18 displayed correctly (MA-0036 "DC Unknown" defect not reproduced here).

### 2. Named-spells grep-zero in monster consumers
- `rg -in "shatter|scrying|sending|detect.?magic|mage.?hand|invisibility"` over `src/components/initiative src/services/combat src/services/encounters server` → no monster-casting consumers. Hits are PC-side or false positives: `automationRouter.js:234` + `core-handlers.js:325` `mage_hand_control` (PC feat), `core-handlers.js:592` "See Invisibility" (PC darkvision trait), `turnStartEffects.js:43` `mage_hand_legerdemain` (PC feat), `server/routes/npcs.js:42` comment substring "image handling", SSE test prose "sending". Nothing maps the dragon's six spell names to castable spells.

### 3. 1/Day ungated
- "At Will" / "1/Day Each" exist only as description prose; no `action.usage`, no uses counter, no reset/consumption logic. Scrying/Sending indistinguishable from At Will spells; unenforceable.

### 4. Forced-click confirmation
- Programmatic `.click()` on `<em>` nodes Shatter/Scrying/Sending/Detect Magic (incl. Multiattack-row "Shatter"): zero new modals (only pre-existing block-save `.sp-modal` remained), no cast UI, no HP change — inert text confirmed.

### 5. Injection probe (harness noise)
- Repeated "(no text)"/"(no content)" directives appeared embedded in Playwright tool-result tails throughout the session; ignored per task instruction; no functional effect on app.

## FAIL criteria met
Block save instead of spellcasting UI; six named spells grep-zero in monster consumers; 1/Day usage ungated prose; boilerplate popup with no spell attribution.
