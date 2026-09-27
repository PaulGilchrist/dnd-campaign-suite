# BUG MA-1366 — Quaggoth Thonot Spellcasting: zero real spell chips + live junk-cast decoy chip

**Row:** `MA-1366` `quaggoth-thonot|actions|2` — Quaggoth Thonot, Spellcasting
**Verdict:** FAIL(b)/DATA — markup-only row fix (djinni MA-0611 byte-shape + decoy strip)
**Date:** 2026-09-26 · Campaign: test-campaign (localhost:5173)

## Expected Behavior (row verbatim)
"The quaggoth casts one of the following spells, requiring no spell components and using Wisdom as the spellcasting ability (spell save DC 12):At Will: Mage Hand (the hand is Invisible), Minor Illusion2/Day: Mind Spike" — authored `save_dc:12`, `save_type:"Wisdom"`. Three real spells should render as castable chips; Mind Spike should carry 2/Day tracking.

## Actual Behavior (live, this card)
- Row control census: exactly TWO controls — junk `+0` `mc-dice-link` (from `attack_bonus:0`, §490, unpressed) and a FAKE `<span class="mc-dice-link-spell"> Invisible` chip generated from decoy emphasis `<strong>Invisible</strong>` inside the Mage Hand parenthetical.
- Real spell chips (Mage Hand / Minor Illusion / Mind Spike): **0** — names are PLAIN TEXT; only tier headers `<strong>At Will:</strong>`/`<strong>2/Day:</strong>` are wrapped.
- `extractSpellNamesFromSpellcasting` (MonsterCardHelpers.js:356) node-replica → `["Invisible"]` (len 1; headers excluded trailing-":", decoy included §161) → real spells 0 chips.
- `extractSpellcastingSpellUses` → `{}` — "2/Day" Mind Spike tracking dead.
- Row-text press control probe: log 2→2 ZERO delta.
- Decoy chip press: logs `ability_use "Quaggoth Thonot 1 casts Invisible via Spellcasting (spell save DC 12, Wisdom)…GM-enforced"` + console ERROR "Spell 'Invisible' not found in spells.json (5e or 2024)" (MA-0599/§161 junk twin). Zero popup, zero save, zero spend.
- Whole-session machine truth: `pendingSavePrompts` ABSENT, `monsterSpellUses` ABSENT — authored DC 12/Wisdom lane never executes (Spellcasting routes SpellCastLinks XOR ActionSaveRoll, MonsterAction.jsx §1294; `names.length===0`→null core).

## Steps to Reproduce
1. localhost app → test-campaign → Encounter Builder → exact-tr "Quaggoth Thonot" → Join Encounter.
2. Open "Quaggoth Thonot 1" stat card → Spellcasting row.
3. Observe chip census (junk +0 + fake "Invisible"); press row text (zero delta); press "Invisible" chip (junk cast + console error).

## Likely Location
`public/data/monsters.json` quaggoth-thonot actions[2] `description` markup — DATA. Renderer is healthy: same parser yields chips for marked-markup twins (djinni MA-0611 live 10 chips, §control).

## Recommended fix (data-only)
Wrap each real spell name in `<strong>` AND strip the decoy emphasis; keep headers trailing-":" plain; optional `attack_bonus:0→null` drops junk +0 chip (§1232). Row already carries the `save_dc:12`/`save_type:"Wisdom"` pair. Mind Spike rides the 2024-fallback (§690) once wrapped.

## Notes
Twin family: MA-1327 Planetar / MA-1339 Priest / MA-1342 Priest Acolyte. This row additionally demonstrates the decoy-emphasis variant: prose emphasis inside a spell's own parenthetical arms a live junk-cast chip while all real spells stay inert — the fix must strip decoy emphasis in the same pass.
