# BUG MA-0421 — Bone Naga Spellcasting row renders ZERO spell affordances (all spells inert)

**Row:** MA-0421 | Bone Naga (monsterIndex `bone-naga`) | actions[3] Spellcasting | spell save DC 13, INT
**Campaign:** test-campaign | **App:** http://localhost:5173
**Verdict:** FAIL — Lightning Bolt has no affordance, no save prompt, no dice, no log. Command/Detect Thoughts advisory path (MA-0348 family) unreachable. 1/Day gate untestable (nothing to spend).

## Live evidence (Playwright, localhost:5173)
1. Encounters → checked only "Bone Naga" (`Select Bone Naga` was sole checkbox checked) → Join Encounter.
2. Initiative: Bone Naga 1 (init 23, HP 65/65). Target dropdown set to HexWarlock → server confirmed `"targetName": "HexWarlock"` via `GET /api/campaigns/test-campaign/change-data`.
3. Opened Bone Naga card (`.mc-overlay > .mc-card > .mc-body`, wired modal path; modal passes `handleSpellCast` at MonsterCardModal.jsx:1450).
4. Spellcasting row DOM (`div.mc-action`) — full innerHTML:
   `<strong>Spellcasting.</strong> <span>The naga casts one of the following spells… (spell save DC 13):\n<strong>At Will:</strong> Mage Hand, Thaumaturgy\n<strong>1/Day Each:</strong> Command, Detect Thoughts, Lightning Bolt</span>`
   — **0 buttons, 0 links, 0 `[class*="chip"]` / `[class*="spell"]` nodes**; spell names are plain text inside the span.
5. Whole-modal query for clickable nodes matching Lightning Bolt/Command/Detect Thoughts/Mage Hand/Thaumaturgy → `hits: []`.
6. Direct click on the "Lightning Bolt" text span → no popup, no save prompt, no dice-tray (`popupAppeared: false`).
7. Post-click server truth: campaign log contains only the join + initiative entries (no cast, no refusal, no ability_use); Bone Naga change-data carries no spell-use counters (only `saveBonuses`).

## Root cause (grep-evidenced, data-driven)
- `MonsterAction.jsx` renders Spellcasting chips ONLY via `extractSpellNamesFromSpellcasting(action.description)` (MonsterCardHelpers.js:209), which matches spell names wrapped in `<strong>`/`<em>` only.
- `public/data/monsters.json` bone-naga Spellcasting description wraps ONLY the headers (`<strong>At Will:</strong>`, `<strong>1/Day Each:</strong>`); all five spell names are **plain text** → `extractSpellNamesFromSpellcasting` → `[]` → `SpellCastLinks` returns `null` (MonsterAction.jsx:63).
- `extractSpellcastingSpellUses` (MonsterCardHelpers.js:222) also keys off the same strong/em matches, so it returns `{}` for bone-naga — the 1/Day gate (spellUsesGate, MonsterCardModal.jsx:812) never sees a limit even if a chip existed.
- Contrast in the same file: `archmage`, `lich`, `aarakocra-aeromancer`, `mind-flayer-arcanist` wrap "Lightning Bolt" in strong/em and get chips; **63 of 106** Spellcasting rows across all monsters have clickable spell names — bone-naga (and spirit-naga) do not.
- Code path itself is LIVE and correct for marked-up data (`handleSpellCast` → :1275 `spellHasDamage(spell)` → `executeMonsterSaveSpellCast`; LB def = level 3, DEX half, **8d6 Lightning**, DC 13 from monster row — never reached here).

## Impact
Bone Naga's entire Spellcasting action (Mage Hand, Thaumaturgy, Command, Detect Thoughts, Lightning Bolt) is UI-inert: no cast, no DC 13 DEX save, no 8d6 damage, no advisory log (MA-0348 family), no 1/Day spend/refusal (MA-0352 / :812 gate).

## Suggested fix (NOT applied — monsters.json edit forbidden this run)
Wrap spell names in `<strong>` (or `<em>`) in bone-naga's Spellcasting description, matching the archmage/lich pattern:
`<strong>At Will:</strong> <strong>Mage Hand</strong>, <strong>Thaumaturgy</strong>` etc. A generic plain-text-name parser (names after known headers, comma-separated) would also fix spirit-naga and the other ~43 unmarked rows.

## Cleanup performed
Admin → Clear Change Data + Clear Campaign Log (native confirms), test-campaign only; verified `{}` / `[]`. No monsters.json / manifest / registry edits; no git mutations.
