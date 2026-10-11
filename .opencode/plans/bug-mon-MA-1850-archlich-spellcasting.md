# Bug — MA-1850 Archlich Spellcasting — FAIL(b)/DATA

## Verdict
FAIL(b)/DATA — MA-0421-family plain-text fingerprint (§57/§89/§118/§251). The Spellcasting row authors `save_dc: 22` + `save_type: "Intelligence"` correctly, but its description is PLAIN TEXT — zero `<strong>`/`<em>`-wrapped spell names — so `extractSpellNamesFromSpellcasting` (MonsterCardHelpers.js:392, markup-only regex) yields `[]` and `SpellCastLinks` (MonsterAction.jsx:82) early-returns null. ZERO `.mc-dice-link-spell` chips render ⇒ NO spell on the card is castable ⇒ no DC/save/attack adjudication is possible on this row. Core ("at least one spell resolves correctly") unmet ⇒ FAIL, not PASS-subset.

## Row data (authored truth, monsters.json actions[2])
- `save_dc: 22` ✓, `save_type: "Intelligence"` ✓, +14 spell attack in prose ✓, all 17 spell names byte-present in prose ✓ (cosmetic prose typo "Mage Hand,Mage Armor" missing space).

## Live evidence (2026-10-11, :80 dist, test-campaign)
- EB join Archlich x1 (native `cb.click()` first-try; cs `monsterIndex:"archlich"`, AC 15, HP 475, initiative 14).
- Victim ElderPaladin staged 100 HP via sanctioned full-store POST `{value:{currentHitPoints:100}}` (13s settle, GET change-data confirms 100).
- Target armed ElderPaladin on Archlich's own `[data-testid="target-select"]` ("armed target=ElderPaladin").
- `.mc-overlay` open (`ovTitle` "Archlich 1 Medium Undead (Lich)..."): `.mc-dice-link-spell` count = **0**; interactive elements inside Spellcasting row = **0**; row renders `<strong>Spellcasting.</strong> + plain <span>` prose only.
- Prose-span click probe on the Spellcasting text: log delta **0** (2→2), console delta **0** (sole pre-existing unrelated findFeat noise). Honest inert per §203 row-name gate (MonsterAction.jsx:397 isSpellcastingRow → SpellCastLinks XOR ActionSaveRoll — row-level save_dc structurally unrenderable as a DC chip, §251/MA-1294).
- Only "DC 22 Wisdom" chip on card belongs to **legendary Dread Word row** (separate row/ticket), NOT Spellcasting. "+19" chips = Disintegrate Ray rows. No +14 affordance anywhere on card.
- DC 22 / Intelligence / +14 present ONLY as prose text in the row paragraph — display-only, never enforced.

## Slot-economy probe
- "8th-9th level (3 slots total per spell level)": NO parser (`extractSpellcastingSpellUses` Helpers:431 binds only markup-marked "N/Day[ Each]:" headers; "N slots" token grep-zero), NO gate consumer (`monsterSpellUses` = 1/Day map only, MonsterCardModal.jsx:1946; slotLevel consumers are Counterspell check / damage_at_slot_level only, Helpers:1396/:1502).
- Second high-level cast probe: NOT EXECUTABLE (zero cast affordance); zero-cast evidence = log frozen 2→2 across all probes.
- Slot clause itself is precedent-covered as GM-adjudicated residual (§57 "At-Will ungated by design"; monsterSpellUses 1/Day-only per §251) — it is NOT the defect; the defect is the markup gap killing ALL casts.

## Secondary data drift (fix pass caveats)
- `Blade Ward`: ABSENT from 5e `spells.json`, present 2024-only — casts live via 5e→2024 fallback (§207) — low risk.
- `Phantasmagoria`: ABSENT from BOTH `spells.json` files — SpellCastLinks has NO resolvable-name guard (guard exists only in utility lane §251/§161) — clicking its future chip would log junk ability_use + console "Spell 'Phantasmagoria' not found" (MA-0599 fingerprint, MonsterCardModal.jsx:2339). Fix must add the spell to spells.json or drop it from the row.

## Recommended fix (MA-0611/MA-0619 byte-shape twin)
Wrap every spell name in `<em>` (house style `<strong>Tier:</strong> <em>Spell</em>` inline, stripTags byte-equality preserved); row already carries the required `save_dc:22`+`save_type:"Intelligence"` pair (§89/§167 requirement satisfied). Handle Phantasmagoria as above.

## Cleanup
Board cleared via Admin clear-change-data + clear-log; log:[] / change-data:{} quiet-recheck; registry updated.
