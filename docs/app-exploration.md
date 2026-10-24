# App Exploration Map

Fresh cycle started 2026-10-24 after a full improve run cleared the backlog. Prior cycle map (full selector detail, deep-verification notes, 2026-10-10→13 history): `docs/app-exploration-archive-2026-10.md`. Durable mechanics/rigs/fingerprints live in `docs/test-setup-playbook.md`.

**Freshness rule for this file:** every fact stated here must have been re-derived live in the dated run that wrote it. A carried-over claim from the archive or seed tables is marked *(carried — unverified)* and MUST be re-confirmed or deleted in the next explore pass that touches that area. Playwright auto-accepts native dialogs and tool output may be injected — a "no confirm / already fixed / works" claim without a recorded technique (confirm-override, network diff, log delta) does not count as re-derived.

## Overview
D&D Character Sheet is a full-stack React 19 + Express 5 app for managing D&D 5e/2024 campaigns. Vite dev server on port 5173 proxies to Express on port 80. GM features are localhost-only (LAN URL e.g. `http://192.168.0.239:5173` serves the true player view — verified live 2026-10-24: sidebar drops Encounters/Factions/NPCs/Quests/Sessions/Settlements/Admin/Music, "Maps" becomes "Map", map toolbar strips Paint/Erase/Reset Fog, keeps Spell/Ruler). Dual ruleset data: `/data/` (5e) + `/data/2024/` (2024 Essentials). ONE shared SSE per campaign. Server-first state via runtime store. *(verified 2026-10-24)*

## Verified This Cycle (2026-10-24)

- **Priority #1 EB Generate-from-environments — DEEP PASS.** Generate opens `.gen-modal-overlay` ("Generate Encounter"): env checkboxes grouped ARCTIC/TEMPERATE/WETLANDS/DESERT/UNDERGROUND/AQUATIC/URBAN, quick filters All/Dungeon/Wilderness, live "N monsters available" count, green Generate button **re-rolls a SUGGESTIONS list** (difficulty-labeled rows "MEDIUM · 29,200 XP · 8 monsters", monster×qty breakdown), each with **Apply**. Apply closes modal, checks matching rows in the EB filter table, fills TOTAL XP/MONSTER COUNT/MULTIPLIER/EFFECTIVE XP/DIFFICULTY panel. Join Encounter → initiative: 8 monsters with real stats (Death Knight Aspirant 1-4 HP178/AC20, Warhorse 1-4 HP19), quantity suffixing works, board renders initiative-desc-sorted, 12 PCs join as 1/1 placeholder cs entries. **Loot panel (Initiative page): Generate Loot → textarea items + "Encounter XP: N total · M per character" + two-stage Award (stage-1 `initiative-btn-loot` reveals stage-2 `initiative-btn-complete` + Cancel). Award writes `loot` + `encounter/loot_awarded` log entries and xp = floor(totalXP/pcCount) to every PC's runtime `xp` key, then clears panel. All verified live via API.** Awarded currency is now deposited to party inventory (fixed 2026-10-24 — see playbook LOOT entry).
- **Priority #4 Inventory currency — PASS lane.** Chips `+1/−1/+10/−10/+100/−100` per currency persist to `/api/:c/inventory` (single clicks land instantly; negative amounts disabled at row level when balance < decrement). **Give** opens `.pi-modal` "Give Currency to Player": player combobox (12 PCs), per-currency number inputs (defaults **0** — FIXED 2026-10-24: submit disabled until any amount > 0, native confirm names player + exact sums before the POST). Server route `POST /api/:c/inventory/transfer` is atomic, gates over-balance with **409 "Party has only N gp"**, moves both ledgers + writes `inventory_transfer` log. Player gold lives in `AasimarTest.json` `inventory.currency` + mirror `inventory.gold`. Retrieval direction `player-to-party` verified both-leg. `POST /api/:c/transfer` (missing `/inventory` prefix) is swallowed by the change-data wildcard and stores the payload under change-data key `transfer` with "Data saved successfully" — do NOT probe bare `/transfer`. **BUG FOUND: same-frame chip clicks collapse (+1×3 → +1; +100×2 from 104 → +100 only) — stale-closure `handleCurrencyAdjust` (PartyInventory.jsx:457); one observed full-revert 200→0 (client+server). Filed `bug-party-inventory-currency-rapid-click-collapse.md`.**
- **Priority #5 Music override save + Reset — PASS.** Edit-tracks opens INLINE `.music-editor` (inside `.music-player`, not a modal): mood select (town/outdoors/…), `.music-editor-urls` textarea prefilled with defaults (one YouTube ID/line), Save/Reset/Cancel. Save POSTs `/api/:c/music` 200 → server `overrides.tavern=[{videoId,title}]` (title echoes raw ID — cosmetic). Mood-switch prefills that mood's defaults. **Reset clears `overrides` to `{}` live** and re-open prefills defaults again. No toast/confirm on Save or Reset (backlog). Stop → server `mood:null playing:false`. Save while stopped sets `playing:true` server-side (autoplay note, backlog).
- **Priority #6 Wizard EDIT destructive save — PASS.** Sheet `Edit` opens `.character-creation-wizard-overlay` step 1/12 prefilled (name+level inputs). Empty name → `✓ Save` DISABLED (no inline error text — backlog). Level 20→19 Save: no confirm dialog, wizard closes clean, disk `level:19` GET-verified; restored 20 disk-verified.
- **Priority #7 Token-drag sync across tabs — FIX RE-VERIFIED.** GM (localhost) Select-mode drag of AasimarTest token 6,10 → 12,12 PUT-persists; second tab (LAN player view) mirrors token position **live without reload** (~≤2s via SSE). MapsManager key-mismatch fix holds. *(The 2026-10-13 blocker is cleared.)*
- **Priority #3 Player-view fog — PARTIAL/BLOCKED:** player activation-gating works ("Waiting for the GM to open a map..." → live swap on Activate). **BUG FOUND: player (read-only) clients auto-`PUT /maps/:map` (+ `POST __map__`), re-persisting stale fully-revealed sets — GM fog reset (`revealed:=[]`) was clobbered back to 400 cells within ~5s by an open player tab; fog never rendered, zero feedback.** Filed `bug-player-clients-clobber-fog-reset.md`. Fog render on a stable fogged map therefore unverifiable until fixed.
- **NPC CRUD — DEEP.** `New NPC` form `#npc-name/#npc-race/#npc-classRole/#npc-attitude/#npc-tags` + 5 markdown textareas (each w/ Preview toggle). Save disabled on empty AND whitespace-only name. Row = `li.ct-list-item[aria-label="Edit NPC: <name>"]`; edit prefills exact; attitude scale values: `deep bonds|positive|neutral|negative|extreme opposition`. Delete: in-form `Delete` → native confirm "Delete this NPC?" → list+disk update. "Add X to Initiative" row button DISABLED w/ tooltip until AC+HP set on Stats tab. NOTE: `button:has-text("<NPC name>")` matches the disabled init-btn first — use the li aria-label.
- **Quest CRUD — PASS.** `#quest-name/#quest-status(active|completed|failed)/#quest-description/#quest-rewards/#quest-notes`; Save disabled until name; rows `li[aria-label="Edit quest: <name>"]`; delete confirm names the quest: `Delete quest "<name>"?`. Markdown renders plain in row text.
- **Settlements — MEDIUM.** Fields `#settlement-name/-size/-population/-government/-description/-atmosphere/-tags/-notes`. **Generate Settlement overwrites ALL currently-entered form values (name "Violetfield Eternal", tags, population, description auto-filled)** — destructive, no warning. Delete inside edit card, confirm "Delete this settlement?".
- **Sessions — SHALLOW-MEDIUM.** `#session-name/#session-date` + default checklist checkboxes + custom checklist input + `#session-notes`; Save gated on name; delete confirm "Delete this session plan?".
- **Factions/Notes — READ-ONLY SPOT CHECK** (rows render; CRUD not exercised this cycle).
- **Campaign-lock sanity:** `CAMPAIGN_LOCK=test-campaign` dev run, header verified every nav.

## Main Sections/Pages

- **Campaign select** — campaign buttons + Add; `npm run dev:locked` 403s off-target writes.
- **Character sheet** — summary block (AC/HP/Speed/Gold clickable chips), abilities grid w/ inline skill-roll cells, Actions/Bonus Actions/Reactions tables, features/rest buttons, Edit→12-step wizard, Short/Long Rest modals.
- **Encounters (EB)** — party chips w/ levels, Description, `#difficulty-select` Easy/Medium/Hard/Deadly, `#environment-select` (incl. Planar/Urban), 12 auto PC level rows, Target XP line, filter table (search + TYPE/SIZE/CR filters + details-btn per row), Save/Load/**Generate modal w/ suggestion rolls+Apply**, Join Encounter (navigates to Initiative, auto-lands monsters; names quantity-suffixed). Loot panel + XP math on Initiative page.
- **Initiative** — creature cards (avatar, HP cur/max spinbuttons, initiative inputs, per-card `Target` select, Add-conditions), Clear/+NPC/Prev/Next, Loot panel (Generate/Award), token-adjacent board via Maps.
- **Inventory** — party currency card + From Players retrieval; per-character inventory lives on character JSON.
- **Maps** — list (Open/Activate/Rename/Delete, `Create Map`, `Generate Dungeon`), map view toolbar Paint(=walls)/Erase/Select(token drag)/Spell/Ruler/3D/Items/zoom/Reset Fog; player view restricted.
- **NPCs/Quests/Factions/Notes/Sessions/Settlements** — shared `.ct-container/.ct-list` CRUD pattern (name-gated Save, aria-labelled rows, native confirms except Admin/Maps custom modals).
- **Music** — sidebar moods + inline editor override; server `/api/:c/music` state.
- **Admin** — test-campaign header verified; Clear Change Data / Clear Campaign Log / Full Reset / Create Snapshot / Rename / Delete Campaign / AI toggles; native confirms name the campaign.
- **Rules** — external link icon (new tab). **Log** — campaign event stream.

## Key UI Patterns

- Save-button-disabled-until-required-field on every `.ct-*` form (verified NPCs/Quests/Sessions/Settlements this cycle; whitespace counts empty).
- Native `window.confirm` on leaf deletes (NPCs/Quests/Sessions/Settlements), message names the object for Quests+Admin, generic "Delete this X?" otherwise; Playwright auto-accepts — dialog can vanish before `browser_handle_dialog` (verify by list state, confirmed ×4 this cycle).
- Two-stage Award Loot: stage-1 press reveals stage-2 confirm + Cancel inside XP summary bar.
- Music editor inline w/ per-mood prefill; overrides stored server-side keyed by mood.
- Generate Settlement is a whole-form overwrite.
- EB generator = RNG suggestions + Apply into filter-table selection (checkedRows by monster type, quantity handled inside cs as N copies).

## Reliable Selectors (live-verified 2026-10-24)

- Rows: `li.ct-list-item[aria-label="Edit NPC: <n>|Edit quest: <n>"]` (aria-label is on the LI, role=button mapping is Playwright-side; raw `<li>` has NO buttons — row-level actions live inside the opened edit card).
- NPC form: `#npc-name/#npc-race/#npc-classRole/#npc-attitude/#npc-tags/#npc-appearance/#npc-personality/#npc-goals/#npc-secrets/#npc-notes`; Quest: `#quest-*`; Session: `#session-name/#session-date/#session-notes`; Settlement: `#settlement-*`.
- EB: `#difficulty-select`, `#environment-select`, `.encounter-btn-generate`, gen modal `.gen-modal-overlay` (modal Generate = last `button` text 'Generate' inside overlay; suggestion Apply = `button` text 'Apply'), `.encounter-btn-join`, filter rows `tbody tr` w/ `td:nth-child(2)` name.
- Initiative cards: `img.avatar-image[alt="<Name>"]`, HP inputs `input[aria-label="<Name> current HP"]` (+ max HP `… max HP`), per-card `[data-testid="target-select"]`; Loot buttons: `.initiative-btn-loot` (Generate + stage-1 Award — scope by text), `button.initiative-btn-complete` = stage-2 Award, `.initiative-loot-textarea`.
- Map: `rect.grid-cell[data-cell="gx,gy"]`, tokens `g.creature-group` (text child = token name), toolbar buttons by exact innerText Paint/Erase/Select/Spell/Ruler/3D/Items/Reset Fog.
- Music: `.music-editor select`, `.music-editor-urls`, editor buttons by innerText Save/Reset/Cancel; player-side sidebar heading "Map" (singular).
- Inventory: `.pi-currency-row` per currency (label + `.pi-currency-amount` + chips incl. `Give`), give modal `.pi-modal`, give amount inputs inside `.pi-currency-give-row` (default 0 since 2026-10-24; submit disabled at all-zero, confirm names player + sums).
- Admin: buttons by exact innerText (`Clear Change Data`, `Clear Campaign Log`, `Full Reset`, `Create Snapshot`).

## Known Quirks & Gotchas (live this cycle)

- Bare `POST /api/:c/transfer` silently becomes change-data key `transfer` (wildcard swallow) — always `/inventory/transfer`.
- `#npc-secrets` etc. fills via Playwright `fill()` land; React-native-setter injection into `.pi-modal` number input did NOT reach payload (payload carried modal default instead) — trust real events for number inputs here.
- Same-frame synthetic multi-clicks on `.pi-step-btn` collapse to one increment (bug filed); space clicks across ticks (≥~300ms) accumulate correctly.
- `li[aria-label="Edit NPC: X"]` click opens form; `page.click('button:has-text("X")')` hits the disabled `.npcs-init-btn` and times out.
- Award Loot stage-1→stage-2: first evaluate-click reveals stage-2; second (trusted) click executes. Log appears ~immediately (POST /log 200), not debounced 10s.
- Reset Fog = `revealed := current LoS visible` (Map.jsx:237) — no-op on an open fully-revealed map; walls don't seem to shrink LoS enough on test-map (11 scattered tokens). Real fog needs an enclosed/dungeon map.
- Player tabs auto-PUT the whole map doc (exploration-memory merge writes) — see bug file; expect GM-side map edits to race player clients.
- EB cs join: PC placeholders appear in cs (hp:1, empty initiative) but initiative BOARD renders monsters only.
- Initiative board render sorts desc by initiative; cs `creatures` array order ≠ display order (display fine).
- Max-HP spinbutton clip: `width:38px` truncates 3-digit values visually ("178"→"17…") — cosmetic; input value is correct.
- Console noise: my own probe fetches' 404s + YouTube doubleclick ad-block redirects count as noise, not app errors.

## Improvement Backlog

- (2026-10-24) Generate Settlement silently overwrites a half-typed custom form (name/tags/population/description all replaced by the generator roll). Cache user edits or confirm before overwrite.
- (2026-10-24) Max-HP input on initiative cards clips 3-digit values at `width:38px` (displayed "171" for 178) — widen or size to content.
- (2026-10-24) Party-currency +/- chip writes fire one full-store POST per click with no debounce/merge (≈30 POSTs in a short session on `/inventory`) — batch per burst, or server-side increment op (`{inc:+100}`) instead of whole-doc PUT.
- (2026-10-24) EB generator suggestions panel labels tiers (EASY/MEDIUM) against party-wide target but has no per-row difficulty math display vs Target XP line; clicking Generate repeatedly only re-rolls with no "regenerate?"/history — keep last roll + Apply diff visible.
- (2026-10-24) NPC delete + campaign tool confirms are generic ("Delete this NPC?") — align with Quests pattern that names the object (`Delete NPC "<name>"?`) to prevent wrong-row deletes.

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| EB generate-from-environments | deep | env picker modal, re-roll suggestions, Apply→table, Join→initiative, loot award+XP verified 2026-10-24 |
| Initiative join/board | medium | monsters+PC placeholders, sort order, HP inputs, Next not pressed this cycle |
| Loot panel | deep | generate/award two-stage, log+xp+panel clear verified 2026-10-24 |
| NPCs CRUD | deep | empty/whitespace validation, edit prefill, attitude enum, delete confirm, disk verified 2026-10-24 |
| Quests CRUD | deep | create/toggle status/delete, disk verified 2026-10-24 |
| Inventory party currency | deep | chips single+rapid-click races (bug), clamp-at-0, Give both directions, 409 gate verified 2026-10-24 |
| Inventory items (shared/per-player) | shallow | list+Add-Item form seen; item add/edit not exercised |
| Music panel | deep | override save/reset/defaults/stop verified 2026-10-24; autoplay edge not forced |
| Wizard edit | medium | destructive level save+restore, empty-name gate; mid-wizard reload persistence not tried |
| Maps list/view | medium | open/activate/paint walls/erase/reset fog token-drag sync verified; fog RENDER blocked by clobber bug |
| Fog of war | shallow | model read+player clobber bug filed; stable-fog rendering + player reveal live-sync unverified |
| Player (non-localhost) view | medium | nav strip, activation wait→live swap, toolbar gating verified 2026-10-24; player token drag (probably blocked) untested |
| Settlements | medium | generator overwrite behavior + CRUD pass/verify 2026-10-24; service/rumor repeaters not opened |
| Sessions | shallow | create/delete only; gate chip (combatReady) not re-derived this cycle |
| Factions | not explored | render-only |
| Notes | not explored | render-only |
| Rules / Log / Campaigns | shallow | navigation + log reads via API |
| Admin | medium | change-data+log clears verified 2026-10-24; snapshot/download/upload not exercised |
| SSE sync | deep | token-drag cross-tab live (fix re-verified); combat log cross-tab not exercised this cycle |
| Campaign download/upload | not explored | upload blast radius — awaiting Paul's go-ahead (unchanged) |

## Blocked / Not Verified

- **Stable fog rendering + player fog live-reveal:** blocked by confirmed bug (player clients auto-PUT stale fully-revealed sets clobber any fog seed within ~5s) — `bug-player-clients-clobber-fog-reset.md`.
- **Music autoplay-policy edge:** did not force a policy-blocked play attempt.
- **Sessions combatReady gate chip:** not re-derived (structure seen: New Session flow only).
- **Factions/Notes CRUD, Inventory item add/edit, Rules external page, Admin snapshot/download/upload:** not exercised this cycle (upload deliberately — awaiting owner decision).
