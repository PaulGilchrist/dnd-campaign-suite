# Arena & Starter Campaigns — Build + Verify (continues `levels-1-4-strengthening.md`)

> Session-ready follow-up for **Phase 3.1 (Arena preset)** and **Phase 4 (Starter
> campaign)**, plus the **Phase 3.2 betrayal validation pass**. Phases 1, 2, and 3.2
> (the tracker ally editor) are DONE + live-verified — see the Status table in
> `levels-1-4-strengthening.md`. This file is the remaining build+test backlog.
> Written 2026-11-02.

## 0. Non-negotiables every session

- **Campaign lockdown.** Only `test-campaign` plus the two throwaways **`qa-arena`**
  and **`qa-starter`** (owner ruling 2026-11-01) may be created/edited/deleted.
  `Frostfall`, `Testing G1/G2/G3` are PRODUCTION — read-only, never select/write.
  Verify the header reads the intended campaign after every select. If any other
  campaign is touched → STOP and report.
- **Restore baselines.** Leave `test-campaign` at change-data `{}` + log `[]`; leave
  `public/campaigns/` with no `qa-*` folders at end of run.
- **Restart the QA-locked API** (the plain `api:locked` script is single-name and
  cannot create throwaways):
  ```bash
  # :80 API with the allowlist lock (only qa-* + test-campaign writable)
  CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js > /tmp/qa-api.log 2>&1 &
  # :5173 Vite (unchanged; proxies /api → :80)
  npm run dev:react &
  ```
  Already verified: with this lock, `POST /api/campaigns {campaignName:"qa-arena"}`
  → **201**, `{campaignName:"Frostfall"}` → **403**; `DELETE /api/campaigns/qa-arena`
  (localhost) allowed, production 403. Lock unit tests: `server/utils/campaignLock.test.js`.
- **GM features are localhost-only.** Drive the app at `http://localhost:5173` in
  Playwright (hostname `localhost` ⇒ GM powers). A player tab uses the printed
  LAN URL.
- Read `docs/app-exploration.md` before live work; follow its two-pass closed-tab
  clear doctrine. Reuse code — do NOT re-implement generators/services.

## 1. Reused building blocks (confirmed signatures)

| Need | Function | Notes |
|---|---|---|
| Create campaign | `POST /api/campaigns { campaignName }` | only set members pass the create guard |
| Delete throwaway | `DELETE /api/campaigns/:campaign` (localhost) | allowlist-gated; purges memory so no resurrection |
| Dungeon map | `generateDungeon({ gridSize, density, seed })` → `{ name, description, gridSize, seed, walls:["x,y",…], placedItems:[…], players:[], zoom,panX,panY }` | `src/services/maps/dungeonGenerator.js` |
| Persist map | `createMap(campaign, mapName, options)` then `saveMapData(campaign, mapName, data)`, `activateMap(campaign, mapName)` | `src/services/maps/mapsService.js`; `createMap` POSTs `{name,type:'indoor',...options}` |
| Hex terrain | `generateHexTerrain(...)` | `src/services/maps/hexTerrainGenerator.js` (confirm opts in-file) |
| Encounter | `saveEncounter(campaign, name, data)` where `data = { round, activeCreatureName, creatures:[{name,type:'monster',ac,hp,maxHp,speed,initBonus,conditions,effects,notes}] }` | shape confirmed from `test-campaign/data/encounters.json` |
| Settlement | `generateSettlement(existingSettlements, options)` | `src/services/campaign/settlementGenerator.js:334` |
| Quests/Factions/NPCs/Notes | their `*Service.js` CRUD + `jsonEntityCrud` routes | one file per domain under `src/services/` |
| Teams → allegiance | `setAllyList(name, allies, campaign)` (shared `selectedAllies` key) | engine already consumes via `getAllyList` — **one allegiance model, D4** |
| Low-CR classics (all present in `monsters.json`) | Skeleton .25, Goblin .25, Kobold .125, Zombie .25, Wolf .25, Bandit .125, Orc .5, Hobgoblin .5, Bugbear 1, Giant Spider 1 | use by exact name so Encounter Builder / `getMonsterData` resolve real stats |

## 2. Phase 3.1 — Arena Campaign preset (BUILD)

**Owner scenarios (from discussion):**
- Scenario 1 (this phase): a **disposable arena campaign** — a dedicated folder,
  players build arena characters there, delete when done.
- Scenario 2 (DONE in 3.2): in-campaign PvP/betrayal via the tracker ally editor.

**Build steps**
1. `src/services/campaign/seededCampaign.js` — a shared orchestrator used by BOTH
   3.1 and 4. API: `createSeededCampaign(preset, { name, seed })` that:
   a. `POST /api/campaigns { campaignName:name }` (throw the server error text on 403),
   b. runs the preset's seeding functions (below) via the services in §1,
   c. returns `{ name, seeded:{ maps:[…], encounters:[…], … } }`.
2. `ARENA_PRESET`:
   - 1–2 arena indoor maps: `generateDungeon({ gridSize: 24, density: ~0.55, seed })`
     tuned for an open central hall + two side entrances (document the exact opts you
     land on); `createMap` → `saveMapData` → `activateMap` the first.
   - A **sparring encounter pool**: 2–3 `saveEncounter` rows drawn from the §1 classics
     by name (e.g. "Sparing — Goblin Pack", "Sparing — Skeleton Watch") so Join works.
   - **No** quests/factions/settlements/NPCs (arena stays lean).
3. UI: `src/components/campaign-selection/CampaignSelection.jsx` — a **New Arena
   Campaign** button (localhost-only, next to Add) that prompts a name (default
   `Arena-<yyyymmdd>`) and calls `createSeededCampaign('arena', …)`, then reloads to
   the new campaign. Keep the existing plain "Add" untouched.
4. Team setup: re-use the **tracker ally editor (3.2)** as the assignment primitive —
   a team = set each member's ally list to its teammates. (Optionally add a thin
   "Assign team A/B" convenience that writes ally lists; do NOT add a new allegiance field.)
5. XP/loot default off in arena (no `Complete Encounter` prompt); leaving loot/XP
   panels intact is acceptable — they are opt-in already.

**Do not**: invent a "level-down event copy" (owner chose disposable folder instead, D5).

## 3. Phase 4 — Starter Campaign (BUILD)

1. `STARTER_PRESET` in the same orchestrator, seeded from a rolling seed stored in
   the campaign (`data/starter-seed.json`) — fixed skeleton, fresh content each roll:
   - settlement (`generateSettlement([], { size:'village', … })`),
   - one small hex map with the settlement POI + a dungeon POI whose
     `linkedMap` points at the dungeon (POI portal lane is indoor-linked-on-outdoor;
     party-adjacency gates the Enter badge — expected),
   - a BSP dungeon map, walls/props from `generateDungeon`,
   - 2–3 quests (hook/side/payoff) referencing the generated names,
   - "Dungeon Wave 1-3" saved encounters from the §1 classics,
   - a loot cache (placed-item chest on the map, or an unawarded encounter reward —
     pick whichever needs no new code).
2. **Regenerate adventure** (Campaign Admin, GM-only, confirm): re-roll the
   dungeon/monsters/treasure layer + re-point the main quest's dungeon link; keep
   settlement, party, log.
3. **First-session checklist**: dismissible panel (`src/components/campaign-starter/`)
   shown when a `starter-seed.json` exists; steps deep-link into real views and name
   the *generated* entities. Completion writes nothing (pure onboarding).
4. UI entry: `New Starter Campaign` on campaign-selection (same orchestrator as 3.1).

## 4. Phase 3.2 — betrayal VALIDATION pass (audits, likely small fixes)

Allegiance is one model; **audit each consumer to confirm it reads
`getAllyList(...)` and does NOT hardcode "all `type==='player'` are allies"**. For
each, add/extend a focused unit test with an **edited** ally list proving PvP / NPC-
vs-subset behavior flips immediately. Start points (already ally-aware — verify):
- `src/services/rules/effects/auraDamageService.js`
- `src/services/combat/auras/elderChampionAuraUtils.js`, `auraOfProtection.js`
- `src/services/encounters/monsterRedirectAttack.js`
- AoE overlay auto-select (`useLoggedDiceRollDamage.aoe-overlay`), save-prompt fan-out
  (`savePromptUtils.js`), opportunity-attack reach, sneak-attack adjacency.
- Grep suspects: `grep -rn "type === 'player'\|type==='player'" src/services src/hooks`
  and confirm each is not an allegiance assumption.
Add (if missing): friendly-fire **confirm** when the chosen target is in the attacker's
own ally list (UI-local confirm, engine still resolves); log-flagged.

## 5. Playwright verification scenarios (run after each build slice)

Use Playwright MCP; **every `waitFor` ≤ 5s**, dialogs via `browser_handle_dialog`,
`--max-time` on curl. Set `navigator` viewport ~1728×972 to match the table screen.

### 5A. Arena (throwaway `qa-arena`)
1. Restart QA-locked API (§0). Open `http://localhost:5173` → click
   **New Arena Campaign** → name `qa-arena` → Create. Assert: campaign list now
   includes `qa-arena`; selecting it shows an activated arena map + the sparring
   encounters in Encounters; header reads `qa-arena`.
2. **+ NPC** a monster, 🎮 **assign control** to a player, open a **second (LAN)** tab,
   click the monster avatar on the LAN tab → interactive card opens; roll one action
   (prove cross-device control) — expect a real to-hit popup.
3. Join a sparring encounter → **TV mode** → screenshot the spotlight + up-next;
   advance a turn → re-center; set an ally/team via 🤝 Allies; **Clear** → Victory
   banner ("N drove off", kills-only); dismiss.
4. Delete `qa-arena` (Admin delete-by-typed-name, or `DELETE` API on localhost). Assert
   it is gone from disk; production campaigns untouched (`git status` clean under
   `public/campaigns/` except intended files).
5. Zero console errors across the session.

### 5B. Starter (throwaway `qa-starter`)
1. **New Starter Campaign** → `qa-starter`. Assert settlement row, hex map with
   settlement+dungeon POIs, dungeon map, 2–3 quests, Wave 1-3 encounters all render;
   first-session checklist appears with the generated names.
2. Join Wave 1 → fight on TV → Complete/Clear → Victory. **Regenerate adventure** →
   new dungeon/monsters/treasure, settlement + party preserved, checklist references
   the new names.
3. `GET`/md5-compare the two dungeons differ (regenerated). Delete `qa-starter`.

### 5C. Betrayal (use `test-campaign`, then restore to `{}`/`[]`)
1. Two tabs on `test-campaign`; join a small encounter.
2. 🤝 Allies on a PC → deselect party (self-only) → Confirm → on the LAN tab that PC
   is now attackable/targetable by the party and its own auras no longer cover allies;
   screenshot the flip. Restore (Select All) or clear change-data at the end.

### Regression smoke (Phases 1–2, already verified — re-run cheaply if time permits)
- TV toggle/persist/fullscreen-fallback; up-next; −/+/big floaters + bloodied; victory
  banner kills-only copy + reload persistence; 🎮 assign/release control + audit rows.

## 6. Definition of done (this file)
- 3.1 + 4 implemented via the shared orchestrator, 3.2 validation pass complete with
  new/updated tests.
- `npm run lint` (0 warnings) · `npm run test:run` green · `npm run guard:no-timers` OK
  (floaters/checklists add no game timers).
- Playwright 5A/5B/5C pass with **zero console errors** and **baselines restored**
  (test-campaign `{}`/`[]`; no `qa-*` folders left; `git status` shows only intended
  files).
- Update the Status table in `levels-1-4-strengthening.md` and docs (`users-guide.md`,
  `README.md`) for Arena + Starter, then re-open the **Level 5 (solo/GM-optional)**
  re-analysis the owner deferred until 1–4 were strengthened.
