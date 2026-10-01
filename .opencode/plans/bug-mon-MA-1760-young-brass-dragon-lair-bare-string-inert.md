# MA-1760 — Young Brass Dragon lair_actions[0] "Unnamed lair actions 1" (strong wind) — BARE STRING INERT

**Status: FAIL(b) / DATA — bare legacy string never becomes clickable.**
MA-1747/MA-1753 exact bare-string twin. `typeof la === 'string'` short-circuits the static branch at MonsterCardBody.jsx:358 BEFORE `isLairRowClickable` is ever called — the row cannot even reach the name gate, cannot even reach the refusal seam.

## Disk quote (public/data/monsters.json, young-brass-dragon)

`lair_actions[0]` (this row — MA-1760) = **BARE STRING** (no dict, no `name`, no `save_dc`):

```
"A strong wind blows around the dragon. Each creature within 60 feet of the dragon must succeed on a DC 15 Strength saving throw or be pushed 15 feet away from the dragon and knocked prone. Gases and vapors are dispersed by the wind, and unprotected flames are extinguished. Protected flames, such as lanterns, have a 50 percent chance of being extinguished."
```

Distinguished from sibling:
- `lair_actions[1]` = MA-1761 — byte-identical prose inside a nameless dict (`description`, `save_dc:15`, `save_type:"Strength"`, NO `name`). Second consecutive inert row, same wind, same DC. DISK WINS: the raw forms above were re-quoted from disk this session.

## Kill chain (code fingerprints, live-confirmed today)

- `src/components/encounter/MonsterCardBody.jsx:358` — `if (typeof la === 'string' || !isLairRowClickable(la))` → bare string hits the FIRST disjunct; static branch :361 plain `<span dangerouslySetInnerHTML>`; clickable chip lane :376-388 unreachable.
- `src/services/encounters/monsterLairActions.js:26` — `!row.name` name gate never even invoked for this row (string died at the render gate).
- Headless (node import, this session): `isLairRowClickable(row0)` = **false**, `lairRowAffordance(row0)` = **null** as-authored.

## Live probe (test-campaign, 2026-09-30 — header verified `test-campaign`)

Board IN initiative round 1: Young Brass Dragon 1 (110/110, init 19), Bandit 1 (hp 849, Incapacitated DC 14 + Unconscious DC 14), Bandit 2 (hp 929, same). Servers :5173/:80. INNER `img.avatar-image` "Young Brass Dragon 1" → `.mc-overlay`.

Lair row #1 affordance inventory (rendered `div.mc-action`):

| affordance | present |
|---|---|
| `<strong>` name header | ❌ 0 |
| `<button>` | 0 |
| `[role=button]` | 0 |
| `tabindex=0` | 0 |
| `.mc-dice-link` / `.mc-dice-link-lair` chips | 0 |
| icons | 0 |
| computed cursor | `auto` (not pointer) |

Single plain `<span>` child. Contrast: SAME overlay renders live chips for Rend `+7`, Fire Breath `11d6`/`DC 14 Dexterity`, Sleep Breath `DC 14 Constitution` — absence is the gate, not a card-wide render failure.

Click probe row #1 → **zero effect**: no popup, no `mc-prerequisite-refusal`, no save prompt, overlay unchanged.
Log GET `/api/campaigns/test-campaign/log` (own :80 GET) before = 33; after both row probes = **33, zero delta**, zero `lair_action_refused`. Zero console errors.
Screenshot: `.opencode/plans/ma1760-1761-lair-rows-inert.png`.

## Fix note — ONE-FIELD lane, then zone-template NOT needed (MA-0378 family)

Canonical fixed twin already on disk: **adult-brass-dragon `lair_actions[0]` "Strong Wind" (MA-0074)** — description byte-identical to this row (verified `===` headless), plus `name` + `dc_success:"none"` + `save_effect` with Failure/Success vocabulary. Recommended fix = promote this string to that byte-proven dict (`name:"Strong Wind"`, `save_dc:15`, `save_type:"Strength"`, `dc_success:"none"`, MA-0074 `save_effect`) → 'save' affordance + chip `DC 15 Strength`; prone rides the MA-0017 damageless failed-save seam (`extractConditionsFromSaveEffect` (MonsterCardHelpers.js) → `['prone']`, locked by MA-0074 data lock in monsterLairActions.test.js:433-466).

Grep-zero residuals stay GM-advisory (§70): push distance (`push` te :1324 has no wind consumer — MA-0074 comment "no push/flame te consumer app-wide"), gas dispersal/flame extinguish (only prose at targetEffectDefinitions.js:257 + stinkingCloudHandler.js:28 comment "no wind"), initiative-20 cadence, 24h immunity. NO `zone` key (point-origin aura around the dragon, not a centered area). DO NOT edit `docs/monster-actions-manifest.json`.

## Systemic note

7th consecutive inert lair row today (black trio MA-1747/48/49 → blue trio MA-1753/54/55 → brass pair MA-1760/61; this = #7): every young chromatic dragon ships lair_actions as duplicated prose — bare string + nameless dict copy — while the adult twin is fixed structured (MA-0074). Systemic young-dragon lair_actions data-generation defect, not per-monster noise.

## State left
Board left IN initiative round 1 for MA-1761. No disk data edits; manifest untouched; no git writes.
