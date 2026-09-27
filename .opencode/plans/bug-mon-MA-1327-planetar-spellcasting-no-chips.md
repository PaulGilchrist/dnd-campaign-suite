# BUG MA-1327 — Planetar "Spellcasting": zero spell chips, no cast affordance

## Overview
Planetar's Spellcasting action row renders **zero clickable spell chips** on the live monster card. The row's spell list lives only in the description markup (`spells` field is null), and the description wraps only the tier headers (`<strong>At Will:</strong>`, `<strong>1/Day Each:</strong>`) — the five spell names are PLAIN text. The `SpellCastLinks` renderer therefore extracts no names and emits nothing, leaving the row with no spellcast affordance whatsoever (only a junk "+0" attack chip from `attack_bonus: 0`, plus no DC chip). This is the §89 MA-0421 / §648 MA-1230 / §676 MA-1294 fingerprint.

## Expected
Row data (monsters.json):
```
"description": "The planetar casts one of the following spells, requiring no Material components and using Charisma as spellcasting ability (spell save DC 20):<br><strong>At Will:</strong> Detect Evil and Good<br><strong>1/Day Each:</strong> Commune, Control Weather, Dispel Evil and Good, Raise Dead"
"save_dc": 20, "save_type": "Charisma", "attack_bonus": 0
```
Per the FIXED byte-shape precedent (night hag MA-1230, djinni MA-0611), each spell NAME must be individually `<strong>`-wrapped:
- Night Hag: `"<strong>At Will:</strong> <strong>Detect Magic</strong>, <strong>Etherealness</strong>, <strong>Magic Missile</strong> (level 4 version)<br><strong>2/Day Each:</strong> <strong>Phantasmal Killer</strong>, <strong>Plane Shift</strong> (self only)"`
- Djinni: `"<strong>At Will:</strong> <strong>Detect Evil and Good</strong>, <strong>Detect Magic</strong> ..."`

With that shape the card renders five `span.mc-dice-link-spell` chips (Detect Evil and Good, Commune, Control Weather, Dispel Evil and Good, Raise Dead) routing `onSpellCast`, honoring the Charisma DC 20 cast lane.

## Actual (live, test-campaign, Planetar ×1 via EB)
- Spell-chip census on card overlay: **0** `span.mc-dice-link-spell` anywhere on the card, 0 inside the Spellcasting row.
- Spellcasting row contains only the junk `+0` attack chip (`mc-dice-link :: +0`) from `attack_bonus: 0` and the sanitized plain-text description; spell names are bare text inside an unclassed `<span>` (no role=button, no handler).
- DC-chip census: only ONE `.mc-dice-link-save` on the whole card — `"DC 20 Dexterity"` from the **Holy Burst** row. NO DC 20 Charisma chip on Spellcasting (row early-returns `SpellCastLinks` before the save renderer).
- Click dispatched on plain-text "Detect Evil and Good": no popup, no modal; campaign log delta **0** (baseline 2 entries → 2 entries after click+1.2 s wait). Zero cast affordance confirmed live.

## Steps to Reproduce
1. `npm run dev`, open http://localhost:5173, join **test-campaign** (header verified).
2. Encounters → search "Planetar" → check box (Qty 1) → **Join Encounter**.
3. On Initiative, click `img.avatar-image[alt="Planetar 1"]` → `.mc-overlay` opens.
4. Inspect Spellcasting row: `document.querySelectorAll('.mc-overlay span.mc-dice-link-spell').length === 0`; only affordance is the junk "+0" chip; clicking the plain spell names does nothing.

## Likely Location
- **DATA** — `public/data/monsters.json` Planetar Spellcasting `description`: spell names (Detect Evil and Good, Commune, Control Weather, Dispel Evil and Good, Raise Dead) need individual `<strong>...</strong>` wrappers (djinni/night-hag fixed byte-shape). Junk `attack_bonus: 0` should also be dropped.
- **Renderer (why plain names ⇒ no chips)** — `src/components/encounter/MonsterCardHelpers.js:359`: `const re = /<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g;` with `:363` `if (!name || name.endsWith(':')) continue;` — only markup-wrapped, non-header names are extracted; Planetar's only matches are the tier headers, both skipped ⇒ `names.length === 0` ⇒ `MonsterAction.jsx:83-84` `SpellCastLinks` returns `null`.
- DC renderer never reached: `MonsterAction.jsx:350-351` (spellcasting rows early-return before `ActionSaveRoll`, so `save_dc: 20` produces no DC chip even if intended).

## Notes
- Registry: Planetar CR 16, 15,000 XP, HP 262, Init 26 (joined fine); chip census taken with attacker active (not incapacitated), so no gating false-negative.
- Zero-chip outcome is purely the markup fingerprint — matches MA-0421 / MA-1230 / MA-1294 family; fix is data-side re-wrap, no renderer change needed.
- Live verification done 2026-09-26 via Playwright MCP on test-campaign; evidence screenshot `.opencode/plans/ma-1327-planetar-card.png`.
