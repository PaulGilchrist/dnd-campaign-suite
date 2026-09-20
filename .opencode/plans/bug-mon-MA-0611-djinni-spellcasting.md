# Bug: MA-0611 Djinni — Spellcasting row renders ZERO spell chips (unmarked names)

## Overview
**Verdict: FAIL(b) — DATA GAP.** MA-0576/MA-0572/MA-0599-family spellcasting-markup twin. Djinni's Spellcasting action (public/data/monsters.json `djinni` actions[4], stableKey `djinni|actions|4`) authors its 10-spell list as plain text. `extractSpellNamesFromSpellcasting` (src/components/encounter/MonsterCardHelpers.js:292-303) only recognizes spell names wrapped in `<strong>`/`<em>` and skips marked text ending in `:` (line 299). Disk marks ONLY the three tier headers (`<strong>At Will:</strong>`, `<strong>2/Day Each:</strong>`, `<strong>1/Day Each:</strong>`) — all end `:` → extraction `[]` → `SpellCastLinks` renders nothing (MonsterAction.jsx:62-63) → zero clickable spell affordances on the live joined card. `extractSpellcastingSpellUses` (MonsterCardHelpers.js:305-320, §141) binds `2/Day Each:`/`1/Day Each:` limits ONLY to marked names → uses map `{}` → the eight gated spells (3×2/Day + 5×1/Day) invisible AND ungated by construction. Row-level `spell_save_dc: 17` never renders a save-shell chip either (row named "Spellcasting" renders SpellCastLinks XOR ActionSaveRoll — §115/MA-0532). No cast, save, or N/Day spend adjudication reachable at all.

## Expected (manifest row + monsters.json)
- Manifest MA-0611: monster Djinni, actionIndex 4, actionName "Spellcasting", actionType `spellcasting`, saveDc 17, verified "not verified".
- Authored row: `spell_save_dc: 17` (numeric ✓, prose "spell save DC 17" matches — NOT MA-0237 prose-DC class), `spellcasting_ability: "Charisma"`.
- Authored spells (10, three tiers — NOT 12): At Will: Detect Evil and Good, Detect Magic (2, ungated) · 2/Day Each: Create Food and Water, Tongues, Wind Walk (3, limit 2) · 1/Day Each: Creation, Gaseous Form, Invisibility, Major Image, Plane Shift (5, limit 1).
- Expected per §57/§89/§115/§141: ten `.mc-dice-link-spell` chips; 8 gated via `monsterSpellUses` (2nd 2/Day and 2nd 1/Day use refused with `automation blocked`); tier headers skipped.

## Actual
- **Static (decisive):** disk dump actions[4] — `<strong>`/`<em>` spans present = exactly 3: `At Will:`, `2/Day Each:`, `1/Day Each:` (all end `:`, parser-skipped). Marked spell names = **0** → chips `[]`, uses `{}`. No decoy mid-prose emphasis (no MA-0599 fake-chip variant — "wine instead of water" parenthetical is plain text). `save_dc` absent but `spell_save_dc: 17` numeric.
- **Live (test-campaign, header-verified):** EB join exact "Djinni" + "Bandit" qty 1 → cs `[Djinni 1 hp218, Bandit 1 hp11]`. Card open (.mc-overlay, AC 17): Spellcasting row `.mc-action` links = `[]`; card-wide `.mc-dice-link-spell` = **0**. Renderer healthy — siblings render: Storm Blade "+9", Storm Bolt "+9", Create Whirlwind "6d6" + "DC 17 Strength" save chip. Row inert by markup.
- **Probes:** NOT executable — zero chips means no At-Will cast, no 2/Day double-click refusal, no 1/Day double-click refusal reachable. Log post-audit = 3 entries (encounter join + 2 initiative rolls), zero `ability_use`/spell entries; change-data holds no `monsterSpellUses` keys, "Djinni 1" absent entirely — gating machinery never engaged (§57/§141). No junk-cast fake chips (§158/§57) — no marked non-spell phrases exist.

## Likely Location
DATA — `public/data/monsters.json` djinni actions[4].description markup gap; parser/consumers live and byte-stable (MA-0421 archmage/lich fixed template). Fix = wrap EACH of the 10 spell names `<strong>Name</strong>`, keep tier headers as-is, e.g.
`<strong>At Will:</strong> <strong>Detect Evil and Good</strong>, <strong>Detect Magic</strong>` / `<strong>2/Day Each:</strong> <strong>Create Food and Water</strong> (can create wine instead of water), <strong>Tongues</strong>, <strong>Wind Walk</strong>` / `<strong>1/Day Each:</strong> <strong>Creation</strong>, <strong>Gaseous Form</strong>, <strong>Invisibility</strong>, <strong>Major Image</strong>, <strong>Plane Shift</strong>`. Strip-tags byte-equality proves markup-only diff. Post-fix (§21/§106): DELETE combat-ui-viewingMonster keys + hard-reload + re-join; re-verify 10 chips, 2/Day and 1/Day `monsterSpellUses` gates (`automation blocked` refusal, `mc-dice-link-spell-spent` class) and DC 17 save routing on first live cast.

## Reproduce
1. localhost:5173 → test-campaign (header verified).
2. Encounters → EB → filter "Djinni" → check exact row → filter "Bandit" → check exact td "Bandit" (qty 1) → Join Encounter; cs = Djinni 1 + Bandit 1.
3. Click Djinni 1 avatar → card open (AC 17). Spellcasting row: zero chips, zero affordances; card-wide .mc-dice-link-spell = 0.
4. GET /api/campaigns/test-campaign/log → encounter+initiative rolls only; change-data → no monsterSpellUses.

## Cleanup
npc-remove ×2 (confirm-override) → cs NPCs removed; admin clear-change-data + clear-log (200); curl verified log `[]`, change-data `{}`, cs creatures `[]`. No src/public-data/manifest/git writes.

## Notes
- Task prose said "12 spells total"; disk authors **10** (2+3+5) — enumeration above authoritative.
- Create Whirlwind "DC 17 Strength" chip (MA-0610 row) renders live → row/DC plumbing healthy; defect isolated to Spellcasting markup.
- §152 re-confirmed: EB checkbox needed multiple fresh-rect mouse.down/up cycles.
- Twins: MA-0576 Death Slaad (headers marked/names plain), MA-0572 Death Knight Aspirant, MA-0524/MA-0532; fake-chip variant MA-0599 Deva NOT present here.
