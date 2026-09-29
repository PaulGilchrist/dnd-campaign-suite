# Bug Report — MA-1591 Thri-kreen Psion Spellcasting

**VERDICT: FAIL — zero cast links; DATA drift (missing `<strong>`/`<em>` spell markup)**

Row: MA-1591 · Monster: Thri-kreen Psion (`thri-kreen-psion`) · Action index 2: Spellcasting · save_dc 15 Intelligence (display/authored only)

## Overview

The Spellcasting row on the Thri-kreen Psion card renders as inert plain text. No per-spell
cast links (`mc-dice-link-spell`) appear for Mage Hand, Detect Thoughts, Sending, or Synaptic
Static, so the row offers **zero cast affordance**. The renderer feature (SpellCastLinks) is
live and mature — this is authoring DATA drift in `public/data/monsters.json`, not an
unimplemented seam. Byte-twin of MA-1543 (Storm Giant), codified today in
`.opencode/plans/bug-mon-MA-1543-spellcasting.md`.

## Expected (per manifest row)

> "The thri-kreen casts one of the following spells, requiring no spell components and using
> Intelligence as the spellcasting ability (spell save DC 15): At Will: Mage Hand (the hand is
> Invisible); 1/Day Each: Detect Thoughts, Sending, Synaptic Static"

Expected live: cast links for Mage Hand (at-will repeatable) + Detect Thoughts, Sending,
Synaptic Static (`1/Day Each · N left` counters via the MA-0020 uses gate), each pressing to a
cast with a campaign-log entry.

## Actual (live, Playwright, localhost:5173, test-campaign)

1. EB exact "Thri-kreen Psion" + "Bandit" → both checkboxes confirmed `checked:true` → Join
   Encounter → tracker shows Bandit 1 (init 17) + Thri-kreen Psion 1 (init 7, HP 149/149).
2. Card opened via avatar (§138). Spellcasting row DOM enumerate:
   `<div class="mc-action"><strong>Spellcasting.</strong> <span>The thri-kreen casts …
   Synaptic Static</span></div>` — plain bold name + plain-text span, **zero** buttons in the
   row; `document.querySelectorAll('.mc-dice-link-spell')` → **0 spell chips** document-wide;
   no DC chip (structural MA-1294 on spellcasting rows — expected, not the failure).
3. Full text renders readably: "spell save DC 15", "Intelligence", "Mage Hand", "Detect
   Thoughts", "Sending", "Synaptic Static" all present as plain text only.
4. Press row → no modal, no chip, no state change. Log delta baseline vs after: **3 → 3
   (delta 0)** (baseline entries = Bandit initiative, TK initiative, Encounter Completed).
   No ability_use/spell logs, no monsterSpellUses tracking, no uses-exhausted refusal reachable.

## Root Cause / Likely Location — monsters.json re-markup lane

Disk description (public/data/monsters.json, `thri-kreen-psion` actions[2]) is markup-free:

```
"The thri-kreen casts one of the following spells, requiring no spell components and using
Intelligence as the spellcasting ability (spell save DC 15): At Will: Mage Hand (the hand is
Invisible); 1/Day Each: Detect Thoughts, Sending, Synaptic Static"
```

- `extractSpellNamesFromSpellcasting()` (src/components/encounter/MonsterCardHelpers.js:392,
  regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`) harvests spell names **only** from
  `<strong>`/`<em>` markup → `[]`
- `SpellCastLinks` (src/components/encounter/MonsterAction.jsx:82-84) early-returns `null`
  when `names.length === 0` → zero chips, row inert
- No plain-text spell-name fallback exists; the `<strong>Spellcasting.</strong>` seen live is
  the renderer's name wrapper, not description markup.

## Fix Direction (data-only)

Re-markup the Thri-kreen Psion Spellcasting description in `public/data/monsters.json` to the
dao house-style required to arm the extractor:

```
"The thri-kreen casts one of the following spells, requiring no spell components and using
Intelligence as the spellcasting ability (spell save DC 15):\n<strong>At Will:</strong>
<em>Mage Hand</em> (the hand is Invisible)\n<strong>1/Day Each:</strong> <em>Detect
Thoughts</em>, <em>Sending</em>, <em>Synaptic Static</em>"
```

Notes:
- "At Will:" / "1/Day Each:" must remain `<strong>` headers (extractor skips names ending
  in `:` — MonsterCardHelpers.js:398); spell names must be `<em>`-marked to be harvested.
- MA-0020 numeric uses gate then arms the `1/Day Each` counter + exhausted refusal for
  Detect Thoughts / Sending / Synaptic Static via `extractSpellcastingSpellUses()`.
- Mage Hand "(the hand is Invisible)" parenthetical must sit OUTSIDE the `<em>` so the
  harvested name resolves against spells.json.
- MA-1543 twin cite: identical mechanism, identical fix lane (Storm Giant).

## Cleanup Verified

Initiative: stray NPC 1/NPC 2 + Bandit 1/Thri-kreen Psion 1 removed, Clear accepted (tracker
back to party baseline, no monster/NPC entries). Admin → Clear Change Data + Clear Campaign Log
accepted; verified `/api/campaigns/test-campaign/change-data` → `{}` and Log view `.log-entry`
count → 0. test-campaign only; no production campaign touched.
