# App Exploration Map

**DESCENT RUN CX — 2026-11-05 (post-CW improve pair: BOTH CW-backlog fixes live-verified; PT3+PT4 CLOSED; PT1 descended → 1 NEW BUG (corona inert in AoE picker route); PT2 still no-rig.)**

Live facts (all re-derived THIS run, test-campaign, dev pair `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` :80 + `npx vite --host` :5173):

1. **Ghost Rotate hidden (32e02248c) — CONFIRMED live.** cx-sandbox indoor map with `cauldron` (ghost) + `barrel` (registered): right-click ghost → menu `["Hide","Delete"]` (Rotate gone); barrel → `["Hide","Delete","Rotate"]`. CW backlog bullet closed.
2. **Deactivated-map advisory (878939872) — CONFIRMED live both legs.** LAN tab (isolatedContext 'lan', :5173 via 100.92.171.80) with the table-active map open → API `PUT …/deactivate` → within ~1s `span.map-deactivated-hint[role=status]` "GM deactivated this map — view continues read-only", board never blanked; `PUT …/activate` → hint CLEARS live (no reload). CW backlog bullet closed. LAN sidebar label is **"Map" (singular)** — a `hasText:'Maps'` locator false-times-out on player tabs.
3. **PT4 CLOSED — coalesced-burst cross-tab adoption (e44a1df67 merged shape).** Same-tick cross-creature burst (native value-setter + change dispatch ×2 in one evaluate, 24 ms apart) → exactly ONE `PATCH /combatSummary` whose body carries BOTH creature records (200); server landed both arms round/roster intact; the OTHER (LAN) tab adopted both armed targetNames live from the single merged echo — selects show the values without reload, 0 console errors. Merged-batch cross-tab adoption: PASS.
4. **PT3 CLOSED — hex `character:` drop lane ridden (never before).** Disposable outdoor map via POST `{name,type:'outdoor',gridSize:12}` → editor Grid 24×12. Handler truths: drop appends to marching order (remove EP via panel × → drop `character:ElderPaladin` → re-appended LAST, disk-persisted); duplicate drop guarded; out-of-bounds drop rejected (payload inert despite preventDefault:true); a `partyPosition:null` doc + reopen STILL loader-seeds default center (`useMapLoader.js:182 existing.partyPosition || center`) → the drop's seed-only leg is **unreachable via UI**; off-centre drop leaves marker at default. BIG: **no in-app producer for `character:` on hex view at all** — ItemsPanel (the only `character:` drag, :171) is indoor-only (Map.jsx:537 early-returns to HexMap); HexMap.test.jsx:533 unit-pins the branch → orphan lane (→ backlog). Only synthetic `DragEvent('drop',{dataTransfer})` on `svg.hex-svg` can reach it. GM-touch envelope materialization re-observed: fresh POST-created outdoor file had NO marchingOrder key; one editor open + one edit persisted all-13 order + default partyPosition.
5. **PT1 descended — NEW BUG `bug-corona-aura-inert-in-aoe-picker-route.md`.** Rig: EB Winged Kobold join (14-combatant board), cx-sandbox active with EP bearer (2,8) sunlight_aura Fire/60ft stamp + EF victim (14,8 = exactly 60 ft) + FR (15,8 = 65 ft) + KB npc-token; overlay armed via `POST /spell-overlay {action:'add',overlays:[{id,shape:'sphere',startGridX,startGridY,radiusFt,color}]}` + `overlay-<id>` selected on AS's Initiative card select (cs targetName ✓). AberrantSorcerer sheet → Actions (NOT the spells table — BH renders under `.attacks .left.clickable`) → Cast Spell → metamagic "Cast Without Metamagic" → picker opens and PRE-CHECKS exactly the 3 overlay-hit tokens, but resolution NEVER consults corona: prompt payload `savePrompt-EF-* disadvantage:false` at 60 ft (same as 65 ft control), save-damage log `mode:"normal"` on both player [17] and NPC faces — while the SAME page's live `getCoronaSaveDisadvantageSync` direct probe returns `{disadvantage:true}` for EF/60ft, false for FR/65ft & Cold. Code: SaveAttackAoeModal `computeNpcSave`(:44) + prompt builder (:298 `disadvantage: heightenTarget===…` only) + AreaEffectSaveFlow grep-zero corona; `handleAoeDamage`/`processAoeNpcs` (the only corona-sync callers) NOT reached from sheet casts — picker intercepts; `mapData={null}` at SaveAttackAoeModal:2016 in the overlay branch.
6. **PT2 still BLOCKED (no model rig, ledger-true).** aiConfig `{value:null}`. NO-CONFIG face is honest: Dress button opens docked `ai-instruction-modal` (classes `ai-instruction-*`), typed instruction + "Dress map" → inline "AI is not enabled for this campaign"; the POST still fires and the server 403s BY DESIGN (campaigns-ai.js:26 doctrine) → one console error per attempt (→ backlog nit). Live invention face vs ghost '?' remains owed until a model rig exists.
7. **Ledger corrections made this run:** CW's "no live PC Divine Spark" is TRUE (13-char grep "divine spark" = 0; the 'DivineSpark' near-misses are my own false-positive substrings of "Divine Sense/Health"). No fixture carries channel_divinity automation rows either — the DivineSparkModal face genuinely needs the sanctioned JSON-PUT feature rig.
8. **Session health:** 1 console error LAN+GM totals = my own ai/dress 403 (by-design guard). Zero app failures otherwise, zero lock denials (grep 0). No throwaways created (seeded lanes event-clear CV-era, no touching commits since — verified via git log). Dev pair left running (:80 locked trio, vite :5173); logs /tmp/dnd-api-cx.log, /tmp/dnd-vite-cx.log.

**Freshness for the NEXT run:** CX entered/re-derived: corona family (picker route NEW axis + aoeService sync-lane live probe + savePrompt payload vocabulary), hex `character:` drop + marching panel + outdoor create/activate/delete API lane, SaveAttackAoeModal overlay pre-check + cast pipeline (Actions-section producer location), AI-Dress no-config face, ItemContextMenu ghost Rotate (post-32e02248c), App/Map deactivated hint (post-878939872), storage coalescing cross-tab face. CW rows for ghost/context-menu + deactivated-open face are NOW re-verified current (their fix commits live-proved). Untouched-and-event-clear since CV/CW: throwaway seeded lanes + admin regen pair, allies editor/friendly-fire, TV/victory/delegation, fog-math-walled cases, indoor PlacedItems ghost render (CW-era: unchanged by 32e02248c beyond menu), ItemsPanel, hex3dScene labels, NPC-quest-faction CRUD, PowW/save-prompt/cover/OA/wolf+lion measured, LAN combat. Demote CX rows on commits touching: `SaveAttackAoeModal.jsx|AreaEffectSaveFlow.utils.js|AreaEffectTargetModalBase.jsx|aoeService.js|coronaAuraUtils.js|handleAoeDamage.js|HexMap.jsx|useMapLoader.js(hex)|MarchingOrderPanel.jsx|ItemContextMenu.jsx|MapToolbar.jsx|App.jsx|storage.js`.

## Live-Claims Folded History

<details><summary>CW row (2026-11-05, superseded-as-wholesale by CX above; its fix-verification faces re-proved current this run) + CQ/CR/CU/CV/CS records (folded, full text in git log of this file)</summary>

**CW** (post-CV improve batch): all seven post-CV commits live-verified (ghost-item fix both lanes, burst-PATCH coalescing 3 faces, map self-heal, PT4 never-hijack, hex3d labels, skeleton row, wizard close); parentHex indoor-arm drop lane CLOSED; two backlog bullets filed (ghost Rotate invisible write; silent deactivated-map player view) — BOTH since shipped (32e02248c, 878939872) and CX-verified live.

**CS** (post-CR): stale-sheet fix 3-face PASS; scoped-PATCH arming PASS; PT1 corona 60 ft bug filed → fixed 13dd98cc4. **CQ**: f1deeb510/f07304b66/efa2d311a/da76fc38d PASS; corona-on-attack-roll filed (fixed+verified); PT2 OA denied-on-sticky CLOSED. **CR**: corona attack-lane twins, map-deactivate 6-face, friendly-fire, id-normalize, 400-copy all PASS; stale-sheet ghost-write filed (fixed b1ca01152). **CU**: cross-client HP adopt CLOSED; two-tab PATCH races clean; CS backlog 4/4 consumed. **CV**: full sprite lanes (2D/3D/LAN), throwaway seeded lanes deep (quick-create, wizard gate, ×11 checklist, FULL regen ride, typed-name deletes), ghost-item bug filed (fixed af07dd67e).

</details>

## Priority Targets (next descent)

1. **Corona picker-route fix verification** — when `bug-corona-aura-inert-in-aoe-picker-route.md` is fixed: re-ride the rig (recipe in §5 here + playbook §257+) and pin BOTH faces (prompt payload + NPC-inline `mode`) at 60 ft exact / 65 ft / non-Fire.
2. **How is `handleAoeDamage`/`processAoeNpcs` EVER reached from a PC cast?** Sheet casts intercept into the picker; `context.targetName 'overlay-'` routing (useLoggedDiceRollDamage:101) suggests a damage-chip/reroll lane — find its live producer (popup reroll? monster-side? GM damage button?) or declare the aoeService corona-sync callers orphan too.
3. **DivineSparkModal sync face** — needs sanctioned JSON-PUT feature rig (channel_divinity automation row on War_Cleric + RESTORE); harnesses the same corona measurement via async lane :164.
4. **AI-Dress LIVE invention face** — still owed a model rig (no-config face now verified honest).
5. Deferred low-value list unchanged (3D per-mesh, hex-travel-3D, indoor wand-drag, Lion "another Barbarian" exemption).

## Depth Seeds (live 2026-11-05 CX unless noted)

- **In-page service probe rig (Vite dev only):** `await import('/src/services/...js')` inside `page.evaluate` + call pure exported fns against the LIVE runtime store — perfect seam-isolation (proved `getCoronaSaveDisadvantageSync` healthy while its caller route was inert).
- **Overlay-arm rig:** `POST /spell-overlay?campaign=<c> {action:'add',overlays:[{id,shape:'sphere',startGridX,startGridY,radiusFt,color,label}]}` (validator: finite start coords + positive size per shape + color string, :53-84); every Initiative card select then lists `overlay-<id>`; `action:'clear'` sweeps; persistence rides change-data debounce.
- **PC save-AoE cast pipeline:** spell lives in sheet **Actions** (`.attacks .left.clickable` name) → spell-detail `.popup-overlay` → `Cast Spell` → sorcerer metamagic popup (`Cast Without Metamagic`) → picker `.sp-overlay` "Select creatures…" (overlay pre-checks) → confirm button named `"<Spell> (N)"`.
- **Prompt machine truth:** picker player prompts = `savePrompt-<Target>-<ts>` change-data keys (payload carries `disadvantage/saveDc/saveType/sourceName` — CLA-063 "the payload flag is the machine-truth channel"); resolution logs `roll/save-damage` with `mode` + `saveResult`.
- **Hex drop rig:** `browser_drop svg.hex-svg` lands at element CENTRE only; for exact cells synthesize `new DragEvent('drop',{dataTransfer:DataTransfer with text/plain, clientX,clientY})` on the svg; `getHexFromEvent` honors px.
- **Context menu post-32e02248c:** ghost chip menu = Hide/Delete ONLY; registered sprites keep Rotate; creature tokens still Rotate-hidden (rotation-invariant audit).
- **Two-tab PT rig / maps API bodies / GM-touch reveal / allies+regen rigs:** unchanged (no touching commits) — CV/CW-era seeds + playbook §162-171.

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Corona family (picker route NEW axis; aoeService sync-lane probe; savePrompt payload vocabulary; 60/65 ft + damage-type faces) | **deep (CX — 1 BUG filed)** | `SaveAttackAoeModal.jsx AreaEffectSaveFlow.utils.js aoeService.js coronaAuraUtils.js handlePlayerSaveDamage.js handleAoeDamage.js` — bug-corona-aura-inert-in-aoe-picker-route.md |
| Overlay transport (/spell-overlay add/clear, shape validator, lock doctrine) | **deep (CX)** | `server/routes/spell-overlay.js` — no-config AI lane verified honest |
| Hex `character:` drop + marching order panel + outdoor map create/activate/delete API | **deep (CX — PT3 CLOSED)** | `hex-map/HexMap.jsx:585 hooks/useMapLoader.js MarchingOrderPanel.jsx server/routes/maps.js` — orphan lane + dead seed leg → backlog |
| Coalesced-burst cross-tab adoption (merged 2-record body → single echo → other tab live-adopts) | **deep (CX — PT4 CLOSED)** | `storage.js campaigns-changedata.js CreatureCard.jsx createCreatureHandlers.js` |
| Ghost-type context menu (Rotate hidden post-fix) + deleted-map 404s | deep (CX re-ride / CW render faces) | `map/ItemContextMenu.jsx PlacedItems.jsx` — 32e02248c VERIFIED |
| Map activate/deactivate matrix incl. player-open ADVISORY both legs (armed live + live-clear) | **deep (CX)** | `App.jsx isMountedMapActive MapToolbar.jsx MapDeactivatedHint` — 878939872 VERIFIED |
| EB join → 14-combatant board → per-card target arming (init-select lane) | deep (CX re-ride) | `Initiative.jsx createCreatureHandlers.js` — PC cards render INITIAL avatar-img absent (only monster has img alt; anchor via .creature-card order) |
| AI-Dress no-config face (honest inline refusal + by-design 403) | deep (CX); live-invention face **blocked** (no model rig) | `map/AiDress ai-designer.js campaigns-ai.js` |
| Burst PATCH coalescing same-tab | deep (CW, event-clear — CX re-confirmed merged body × cross-tab) | `storage.js` |
| Admin regen a11y pair + regen cascade + typed-name delete + quick-create flavors + wizard gate | deep (CV same-day; event-clear — no touching commits, re-verified by git log this run) | `CampaignAdmin.jsx RegenerateAdventureModal FirstSessionChecklist CampaignSelection.jsx DeleteCampaignModal` |
| Throwaway seeded lanes (arena/starter) | deep (CV same-day; event-clear) | `CampaignSelection.jsx campaigns-starter-seed.js campaigns-arena*` |
| TV / victory / delegation / allies editor / friendly-fire | carried — event-clear (git log `initiative/` empty since CS-era rows; re-checked CX) | rows as dated CQ/CR/CV |
| Hex 3D diorama labels; ItemsPanel arms; fog-math; NPC/quest/faction CRUD; PowW/save-prompt/cover/OA/wolf+lion; LAN combat; inventory/music/rules-tray | carried — event-clear at CQ/CR/CV/CW | rows as dated |

## Baseline Fingerprints (canonical test-campaign state at CX exit — verified 2026-11-05)

- change-data `{}` + log `[]` — closed-tab quiet clears + re-select-surfaced rehydration trio (combatSummary/__campaign__/AasimarTest) evicted by pass 2 (fingerprint matches CW).
- maps [Battle Arena(false, md5 94fcd0bf VERIFIED), Item Showcase(false), POI Showcase(false), Test Map(false)]; cx-hexdrop + cx-sandbox + Winged Kobold board + AI overlays ALL deleted/cleared (GET 404 honest); spellOverlay store cleared.
- npcs [Marta Copperkettle]; 13 char files byte-untouched (`git status --porcelain public/campaigns/` EMPTY); campaigns/ = 5 baseline folders, no throwaways.
- Lock grep = 0 lines; 1 console error total = own by-design ai/dress 403 probe.
- Bug files this run: 1 (corona picker-route).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

- [2026-11-05 CX] **PC sheet Actions spell rows have no visible cast affordance until clicked** — Burning Hands rendered as bare `div.left.clickable` text (same as cantrips/weapon rows); a wand icon or hover hint would surface the spell-detail popup flow discovered only via trial. Adjacent nit: the Spells tab's slot-level sections didn't list Burning Hands where the Actions section did — worth a consistency look at why a known 1st-level spell renders in one section only.

## Blocked / Deepen Targets (fold-gate ledger)

- CLOSED at CX 2026-11-05: CW backlog pair (ghost Rotate hidden; deactivated-map advisory both legs); PT3 hex character-drag (handler matrix complete: append/dup/bounds/persist + orphan-lane finding); PT4 coalesced merged-batch cross-tab adoption; aoeService SYNC lane correctness (live in-page probe); AI-Dress no-config honesty face.
- CLOSED earlier: CU PT2/PT3, stale-sheet fix, corona range+attack lanes (async seams), allies re-entry + zero-hint, regen ride, quick-create flavors, map activate matrix.
- OPEN: **corona picker-route fix** (new bug file, verify rig ready); **how/whether handleAoeDamage-processAoeNpcs is reachable at all from live UI** (picker intercepts before it — if grep/read shows no producer, its corona-sync callers are a second orphan); DivineSparkModal face (JSON-PUT feature rig); AI-Dress LIVE invention face (model rig); llama.cpp-style refusing backend for jsonSchema:true (infra, unchanged).
- NOT VERIFIED this run (honest scope): handleAoeDamage live route (picker intercepted every cast surface tried); Evasion-halves-on-picker-prompt nuance (fan-out 1/1-placeholder cs entries lack evasionEffects — rig artifact, adjudicating needs a fully-populated player combatant); leading-evasion offered with no bard token on map = accepted gridless-lenient doctrine (§47); owner-fixture maps untouched by design; throwaway lanes not re-entered (event-clear CV).
- DEFERRED (low value): 3D per-mesh geometry; hex travel-in-3D; indoor overlay wand-drag; Lion "another Barbarian with this option" exemption.
