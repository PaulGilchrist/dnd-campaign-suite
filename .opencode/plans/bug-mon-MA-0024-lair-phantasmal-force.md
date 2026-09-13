# Bug — MA-0024 Aboleth · Unnamed lair actions 1 (lair_actions, other) — FAIL (inert flavor)

## Verdict
FAIL — inert flavor (b). Lair actions render as static text with zero affordance, zero execution path, no initiative seam, no phantasmal force save resolution, no 24h immunity tracking.

## Data
- `public/data/monsters.json` aboleth `lair_actions` = array of 3 PLAIN STRINGS. No `name`, no `save_dc`, no damage dice, no `components` fields anywhere in the row. Manifest row name "Unnamed lair actions 1" is a generator placeholder (category + index; strings carry no name).

## Code
- `MonsterCardBody.jsx:51` renders lair rows via `MonsterLairAction` (MonsterCardBody.jsx:306-318): inert `<div className="mc-action">` + `sanitizeHtml` text only. NOT routed through the interactive `MonsterAction` pipeline (no attack_bonus/damage/save_dc affordances exist for lair rows at all).
- grep-zero (production src+server): `phantasmal_force` → 0 consumers. `phantasmal_creatures` handler exists but is the wizard-class feature key (`automationRouter.js:262`, `phantasmalCreaturesHandler.js`) — not consulted by any monster/lair path.
- No initiative-trigger seam: zero lair refs in `encounterToInitiative.js` and `src/components/initiative`; no initiative-20 fixed turn logic; `npcStatBlockUtils.js:80` hardcodes `lair_actions: null`.
- 24h immunity clause grep-zero: no `lairImmune`/lair-immunity/24-hour-la ir runtime keys; the immunity text is prose only.

## E2E evidence (Testing G2, :5173, 2026-09-13)
- EB: checkbox-select Aboleth → Join Encounter → "Aboleth 1" on tracker (rolled init 20 — normal roll, not a lair seam; no lair hooks fire at any turn). Target armed = Aeralyn.
- Card (.mc-overlay) open: lair row 0 DOM = `DIV.mc-action`, 0 buttons/links/clickable, no onclick.
- Click + forced `click()`/`dblclick()`/bubbles: no modal, no popup, no roll, no save prompt.
- Log: baseline 5 → 7 after JOIN only (join-time `encounter` + `roll` entries); ZERO new entries post-click. `character-change-data` = null before and after.

## Fix direction (if ever implemented)
Structured lair_actions objects (name/save_dc/damage/targets), initiative-integration (lair turn, typically init 20 modifier slot), phantasmal_force cast path with CON/INT save + concentration, plus per-target 24h immunity ledger.
