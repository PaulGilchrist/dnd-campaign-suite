# MA-1261 — Oni "Spellcasting" — FAIL(a)/DATA

Date: 2026-09-26 · Campaign: test-campaign · Manifest row NOT edited.
Family: MA-0421/MA-1230/MA-1241/MA-1257 (headers-only `<strong>` = markup-dead row).

## Disk (pre-live)
`public/data/monsters.json` Oni `actions[4]` Spellcasting:
- `<strong>` ONLY on headers: `Spellcasting.` and `1/Day Each:`
- spell names PLAIN TEXT: `Charm Person (level 2 version), Darkness, Gaseous Form, Sleep`
- numeric pair PRESENT: `save_dc:13` + `save_type:"Charisma"` (§89: numeric pair passes ≠ chips)
- `attack_bonus:0` junk → §490 fake "+0" chip rides the row
- Spells census: Charm Person, Darkness, Gaseous Form, Sleep — all 4 present in BOTH
  `public/data/spells.json` (5e) and `public/data/2024/spells.json` (0 missing).

## Live census (EB native cb.click() exact-tick Bandit + Oni → Join Encounter → Oni 1 card)
- Join selection verified via checked-rows audit: Bandit + Oni ONLY (§152 filter swap survives).
- Oni 1 card, Spellcasting row innerHTML fingerprint:
  `<strong>Spellcasting.</strong> <span class="mc-dice-link">…+0</span><span>…(spell save DC 13):<br><strong>1/Day Each:</strong> Charm Person (level 2 version), Darkness, Gaseous Form, Sleep</span><em> ()</em>`
- `.mc-dice-link-spell` census: **0** (row, card, and post-overlay-toggle) — markup-dead confirmed.
- Bogus "+0" chips enumerated UNPRESSED (Shape-Shift row twin also present, MA-1260 junk).
- Headers end ":" → decoy-emphasis fake-chip absent (§161); sole emphasis is headers + cosmetic `<em> ()</em>` tail.
- Prose center-click control probe: zero popup, zero log delta (0→0), zero console errors.
- Overlay toggle audit: close → `.mc-dice-link-spell` 0; reopen Oni card → 0. Console 0 errors whole session.

## Verdict
FAIL(a)/DATA — zero spell affordances despite live numeric DC 13/Charisma pair and all 4
spells indexed. Parser requires name-level `<strong>`/`<em>` (MA-0421 Helpers:356);
headers-only markup yields null chip build (MonsterAction.jsx:83).

## Fix (DATA-only, zero code) — MA-0611 djinni byte-shape
Oni `actions[4]`.description: keep row header + tier header (parse-clean "1/Day Each:"),
wrap all 4 names `<strong>`, numeric pair already present:

```
The oni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13):<br><strong>1/Day Each:</strong> <strong>Charm Person</strong> (level 2 version), <strong>Darkness</strong>, <strong>Gaseous Form</strong>, <strong>Sleep</strong>
```

Residual check post-fix: Charm Person chip is Save (DC 13 Cha per row vs RAW Wis per its own
save_effect prose split — row DC rides chip per MA-0092 ladder precedent); 1/Day gating needs
`monsterSpellUses` key (MA-0276) — absent = spend-then-block refusal lane; verify chips
cast + `1/Day Each:` header gate §57 live after fix.

## Cleanup
Admin clear-change-data + clear-log LAST (per ticket). Log delta stayed 0 across probes.
