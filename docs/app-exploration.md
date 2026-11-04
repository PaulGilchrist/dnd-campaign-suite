# App Exploration Map

**DESCENT RUN CQ — 2026-11-04 (post-CP batch verification: all 4 post-CP commits re-derived LIVE — monster-aura no-map copy fork f1deeb510 PASS both lenient faces; seed-modal a11y role=dialog tier f07304b66 PASS both modals (CP's "NO role=dialog" claim now DEAD); delete-success-toast efa2d311a PASS on BOTH throwaways (one-shot `.success-message` "✅ <name> deleted successfully." on selection page, gone ≤5 s, ghost GET 404); starter-wizard-paint da76fc38d doc-only, wizard-auto-open-on-create face re-observed on qa-starter. PT1 CLOSED — first-ever live corona/duplicity sync-lane faces → ONE NEW BUG: Corona save-disadvantage rides the ATTACK roll (both roller lanes; wrong attacker, non-spell triggers; type+list gates honest, correct save-lane consumer also live ⇒ misplacement). PT2 CLOSED — OA denied-on-sticky face verified end-to-end + dismiss. NEW RIG PILLAR: gridless `__map__` requires close-tabs→restart-API→DELETE-key ritual — a running tab's MapContextSync mirror resurrects curl-null (CP's "adopted live" was luck of flow; playbook addendum written).**

<details><summary>CP run record (2026-11-04, folded)</summary>

**DESCENT RUN CP — 2026-11-04 (post-CO batch verification: all 4 code commits landed after CO re-derived LIVE — wolf gridless honesty fix 15fcfebf3 PASS; monster-lane chip parity b15588852 PASS 6 faces; admin-delete-modal migration bfdd2e7ef PASS (zero native dialogs anywhere, inline role=alert mismatch, folder gone, ghost 404); chooser-backdrop bullet bdba26868 = doc-only. CO PT1 AUDIT CLOSED with a live witness. ZERO new bugs; 2 minor improvement notes.)**

<details><summary>CO run record (2026-11-04 morning, folded)</summary>

**DESCENT RUN CO — 2026-11-04 (post-CN batch: all 8 code commits re-derived LIVE — wolf-aura sync fix 3a4266d6a PASS 4-face matrix; adv-chip fix 54d2ee840; lion log-copy honesty 3db9da635; PC aura reason-threading 2cd75b9de; OA sticky toast 4fea52414; seed-modal singleton 0b938e8fc; map-read cache-bust f1c827835; changedata new-key warn 617ca875e. CN PT3 (PC-sheet COVER legs) CLOSED. ONE NEW BUG filed: wolf gridless lenient chip "within 5 ft" — FIXED 15fcfebf3, CP verified.)**

<details><summary>CN run record (2026-11-03, folded)</summary>

**DESCENT RUN CN — 2026-11-03 (post-CM descent: GM-Activate-without-Open fix 64721eead VERIFIED 7-face matrix; multi-source disadvantage chips d85d2d099 VERIFIED. CJ→CM OA-popup × wolf cross-check CLOSED — caught wolf-aura-unmeasured PC-lane bug + adv-chip mislabel (both since fixed+verified).**

1. **GM-Activate-without-Open fix (64721eead) — PASS 7/7 faces (CM Priority Target 1 CLOSED).** Activate-only measurement matrix incl. delete face (MapContextSync stops re-stamping; re-Activate re-arms — no one-shot). Manager verified: activation never navigates the GM tab.
2. **Multi-source disadvantage chips (d85d2d099) — PASS.** Two 2-source faces + both single-source byte faces; log ledger exact.
3. **NEW BUG — wolf aura unmeasured on the PC roller lane (filed; fixed post-CN by 3a4266d6a, verified CO).**
4. **NEW BUG (minor) — Adv chip borrows rangeReason (filed; fixed post-CN by 54d2ee840, verified CO).**
5. **OA enforcement lane deep (drag-trigger face)** — trigger/denied/economy faces.
6. **LAN player lane auto-open faces** — all 3 verified; GM soft-reload re-select pitfall.
7. **PC sheet lane adjudicates RANGE** (superseded legacy claim) — cover legs were the CO gap, now CLOSED.
8. **UX/session quirks** — vite --host soft-reload deselect; Charger chooser absorbs next click; PC initiative rows need ordinal anchoring; mistyped per-key POST phantom bucket.

</details>

CO live facts (kept as reference until next fold): wolf sync fix 4-face matrix; lion PC-lane threading both faces; monster-lane lion log copy both faces; OA sticky toast; PC-sheet cover legs; seed-modal singleton; qa-arena/qa-starter full lanes (checklist `button.campaign-starter-step` ×10, deep-links live, Admin Regenerate POI re-point layer 2, typed-name delete then-native→now-modal); API-lane fixes (no-store HEAD+GET, new-key warn); 0 console errors.

CP live facts (post-CO batch): wolf gridless fix 15fcfebf3 both faces; monster-lane chip parity b15588852 6 faces; CO PT1 audit CLOSED (lenient-multi-source "within 5 ft" unreachable — the fork stays honest even stacked beside a measured band chip; copy nit monster "(no token)"-on-inactive-map → backlog, since fixed f1deeb510); admin delete = React role=dialog DeleteCampaignModal, zero native dialogs; seed-modal singleton + quick-create defaults `Arena-YYYYMMDD`/`Starter-YYYYMMDD`.

</details>

## CQ live facts (all re-derived THIS run, test-campaign + throwaways, dev pair `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` :80 + `npx vite --host` :5173)

1. **Monster-lane lenient copy fork f1deeb510 — PASS both forks (CP backlog item CLOSED, re-derived).** Rig: EP bucket ONE POST `{activeBuffs [{name:'Rage of the Wilds',optionName:'Lion'}]}` (attacks AIMED AT the bearer are exempt — `lionAuraUtils.js:60 player.name===targetName continue` — arm the KB at **EvasiveFighter**, not EP); Winged Kobold EB-join; battle-arena players[] += `{id:'elderpaladin',gridX:5,gridY:5,type:'player'}` (bearer must be on `players[]`). FACE 1 (map ACTIVE via API, KB token ABSENT from placedItems): chip `Disadv (Lion rage aura — raging ElderPaladin — proximity unmeasured (no token) — GM-enforced)` + log `…rage aura of ElderPaladin applied — proximity unmeasured (no token) — GM-enforced (Power of the Wilds — Lion).` byte-identical to CP M2. FACE 2 (TRUE gridless after the restart ritual below): SAME press prints `…proximity unmeasured (gridless) — GM-enforced` on BOTH chip and log row (fresh dice proves live, not replay). The fork word matches the PC-lane twin exactly.
2. **Gridless-lane PITFALL (cost half a session, playbook addendum written):** `__map__` null POST from curl is RESURRECTED by any live tab (MapContextSync mirrors App state; campaign re-select re-stamps active from the MEMORY-ONLY `activeMaps` via `/maps` isActive). CP's "tab adopted live" only worked because that tab's own flow cleared local state. True-null ritual = close tabs → `pkill node server.js` (only activeMaps reset) → `DELETE /:c/__map__` AFTER restart (before, it no-ops and the 10-s debounce can re-persist active across the kill) → reopen (MapContextSync stamps `{activeMapName:null}`).
3. **Seed-modal a11y f07304b66 — PASS (CP's `[role=dialog]`-timeout claim now DEAD):** both seed quick-create modals ride `[role=dialog][aria-modal=true]` + `aria-labelledby="seeded-campaign-title-{arena|starter}"` → heading; default names `Arena-20261104`/`Starter-20261104`; trio of create buttons disabled while open; Cancel → 0 lingering overlays. `[role=dialog] input` fill NOW works (CP-era `.modal-content` fill recipe still fine).
4. **Delete-success toast efa2d311a — PASS on both throwaways:** typed-name DeleteCampaignModal (danger copy names campaign, inline mismatch `[role=alert]` "Campaign name did not match. Deletion cancelled." dialog stays open) → exact name → silent reload to selection + `.success-message` "✅ qa-starter deleted successfully." (auto-hides ≤5 s, ONE shot) → ghost GET 404, folder gone, no re-materialization. **Zero native dialogs** the whole create→exercise→delete flow (both campaigns). qa-starter: checklist 10 steps, settlement "Priory Green" (names generate per roll), wizard auto-open on create → Cancel. qa-arena: ARENA BATTLE header, campaign-only views hidden, maps [The Colosseum Pit, The Sparring Hall] seeded+active.
5. **PT1 CLOSED — Corona/Duplicity sync-lane faces (first live descent).** Gridless (post-ritual), KB joined, EF Shortbow +7 presses via `.attacks` flat-children (idx-7 anchor, throwaway press first — EF is the Studied carrier, one-shot `Adv (conditions)` pre-empts once).
   - **Duplicity: PASS ×3 faces.** EP `{activeBuffs [{effect:'create_illusion',isImprovedDuplicity:true}], invokeDuplicityAdvantageTargets:['EvasiveFighter']}` ONE POST → press = `Adv (Improved Duplicity)` 2d20-high honest; grant swapped to `['FeyRanger']` → single die normal; isImprovedDuplicity is REQUIRED on the buff (duplicityAuraUtils.js:32).
   - **Corona: fires, but the lane is WRONG → NEW BUG** `bug-corona-save-disadv-applied-to-attack-roll.md`. `sunlight_aura` buff (`enemiesDisadvantageSaves:['Piercing']`) → EF's SHORTBOW (non-spell, ally of bearer) ATTACK roll pays `Disadv (Corona of Light — sunlight aura of ElderPaladin — proximity unmeasured (gridless) — GM-enforced)` (2 presses, `mode:disadvantage` + advantageReason). Damage-type control (stamp `['Radiant']`) → normal ⇒ gate keys off the ATTACK's own damageType; saving throw never rolled anywhere in the flow. Enemies-list control (`coronaOfLightEnemies:['FeyRanger']`) → normal ⇒ designation gate honest. Correct save consumer IS live (`handleNpcSaveDamage.js:110` awaited) ⇒ attack-lane entries (contextBuilder-sync.js:609, contextBuilder-map.js:196-204) are misplaced extras vs the class text ("Disadvantage on saving throws against YOUR spells that deal Fire/Radiant").
   - Sync-lane mechanics note: `resolveCoronaAura`'s non-gridless reason branch is unreachable (with an active map the util refuses without mapData) — matches its code comment; the map-active corona verdict belongs to `accumulateAuraCounts` (contextBuilder-map.js) which counts it into mapDis — ALSO attack-lane (same bug axis).
6. **PT2 CLOSED — OA denied-on-sticky face:** enforcement top-level ON (`POST /:c/enforcement {mode:'on',opportunityAttacks:true,actionEconomy:true}` — server hydrates full dict), battle-arena active, KB token (5,6) adjacent ONLY to EP token (5,5). Trusted drag out (svg.grid-svg matrixTransform px, mouse.down/move×8/up): `enforcement_triggered` + "Reaction spent" + sticky toast; drag back = no trigger; drag out AGAIN: `enforcement_denied {bucket:'reaction',source:'opportunity-attack-trigger'}` "ElderPaladin's reaction is already used — no opportunity attack on Winged Kobold." — toast byte-identical, survives 5.5 s, `button[aria-label="Dismiss enforcement notice"]` clears. CN economy rows + CO trigger rows all re-witnessed in one session.
7. **Friendly-fire confirm (PT4 cheap re-ride) — PASS:** needs an EXPLICIT `selectedAllies` stamp (unedited default NEVER confirms — getAllyList reads the stored key only; the party-by-type split is aura-internal). Native confirm copy verbatim; window.confirm-spy faces: dismiss → select reverts, zero rows; accept → armed + `ability_use friendlyFire:true` audit row.
8. **Session health:** console errors = 1 (my id-less token, §4 above — rig artifact, hygiene note written); zero app 4xx/5xx; zero lock denials; `/api/campaigns/test-campaign/campaign` correctly 400s "Use /:key" (top-level keys are the lane).

**Freshness for the NEXT run:** CQ entered/re-derived: MonsterCardModal lenient tail fork + lionAuraUtils bearer-aim exemption + gridlass __map__ reset ritual + CampaignSelection seed modals (a11y tier + quick-create + delete toast) + DeleteCampaignModal + Admin delete lane + maps activate lane/`activeMaps` memory + EB join + initiative select-arming + `.attacks` flat-children EF presses + contextBuilder-sync corona/duplicity resolvers + opportunityTrigger denied face + friendly-fire confirm. Commits touching `MonsterCardModal|lionAuraUtils|coronaAuraUtils|duplicityAuraUtils|contextBuilder-sync|contextBuilder-map|CampaignSelection|SeededCampaignModal|CampaignAdmin|DeleteConfirmModal|opportunityTrigger|createCreatureHandlers|useAllySelection|MapContextSync|campaigns* server routes` after 2026-11-04 demote these rows. Untouched-and-event-clear since CP/CO: TV/victory/delegation/allies-editor(-UI)/fog/hex3D/inventory/music/rules-tray/NPC-quest-faction-settlement CRUD/AI lanes/PowW producer/save-prompt/cover/CN map-context matrix/LAN faces/wolf-lion measured faces.

## Priority Targets (next descent)

1. **Corona map-active attack-lane face** — `contextBuilder-map.js:196-204` counts corona into `mapDis` on the ATTACK lane with real tokens (the filed bug's map twin); ride the standard token rig, expect the same inversion measured-face. (Low novelty — the bug is filed; only re-derive if the fix lands and needs verification.)
2. **jsonSchema:true refusing backend** — STILL owed (infra, unchanged since AQ; llama.cpp-style refusing probe unavailable).
3. **Allies-EDITOR UI descent** (`src/components` allies picker): the 🤝 editor's own faces (open→toggle→save→audit) were deep at CK/CL; the STORED list's consumers re-verified CQ (aura hostility + friendly-fire confirm). If entering, `git log --since=2026-11-03 -- '*Ally*' allies*` first — event-clear expected.
4. **Corona TRUE save-lane face** — cast a Fire/Radiant save spell (bearer) at a listed enemy and prove `handleNpcSaveDamage.js:110` grants 2d20 on the VICTIM save (the correct axis has never been live-proven — the fix's own repro predates the await).
5. Deferred low-value (unchanged): 3D per-mesh geometry, hex travel-in-3D patch rigs, indoor-overlay wand-drag face, Lion "another Barbarian with this option" exemption (unbuilt+unpinned).

## Depth Seeds (live 2026-11-04 CQ unless noted)

- **Lion bearer-aim exemption (CQ):** attacks targeting the BEARER are exempt from Lion disadvantage (lionAuraUtils.js:60) — always arm monster attackers at a NON-bearer ally face (KB→EF with EP bearer).
- **Gridless reset ritual (CQ):** close tabs → restart API → `DELETE __map__` (after restart!) → reopen; verify GET before judging any "(gridless)" tail. See playbook addendum.
- **Corona/duplicity sync rig (CQ):** gridless + player bearer on the cs board (EB-join fans out all 13 PCs — bearer census falls back to combatSummary players, no map tokens needed); bucket ONE POST; EF throwaway press consumes the Studied one-shot before judging mode; grant-lists are the hostility channel for both (duplicity `invokeDuplicityAdvantageTargets`, corona `coronaOfLightEnemies` — empty/absent = lenient-everyone; `isInCoronaEnemiesList` treats non-string/empty as TRUE=listed-for-all).
- **Corona damage-type shortcut (CQ):** `coronaDamageTypeMatches` returns TRUE for falsy `damageType` (only the authored list must be non-empty) — press a damageType-less attack and ANY corona buff matches; type-gate faces must carry an explicit type.
- **OA denied-face geometry (CQ):** Chebyshev×5 reach rule — park every other token >5 ft from BOTH the from- and to-cells so exactly one defender reacts; single toast slot shows the last write.
- **Friendly-fire rig (CQ):** explicit `selectedAllies` bucket POST + `window.confirm` spy inside one evaluate (see playbook addendum) — avoids the native-dialog wedge entirely.
- **Token PUT hygiene (CQ):** injected `players[]` entries MUST carry `id` (lowercased name) or the editor throws React duplicate-key errors.
- **Maps lanes (CQ):** `PUT /maps/<slug>/activate` sets memory `activeMaps` + `__map__` + SSE; NO deactivate route/UI — restart is the only null-reset (playbook §262/§472 re-proven); `POST /:c/campaign` is a 400 guard — campaign-level keys are top-level (`enforcement`, `aiConfig`).
- **Delete-flow copy (CQ post-efa2d311a):** mismatch `[role=alert]` "Campaign name did not match. Deletion cancelled."; success = silent reload + `.success-message` toast on selection page (gone ≤5 s); ghost GET 404.
- **Carried seeds (CM/CN/CO/CP, event-clear):** bucket-stamp one-POST law; `.attacks` flat-children anchor; popup flush via `.popup-close-btn`/stage-2 el.click(); Charger `.sp-overlay` chooser under popups; EB join/kobold chip lanes; pristine battle-arena at `dist/campaigns/test-campaign/maps/` (md5 94fcd0bf).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Monster-lane lenient aura copy fork (no-token vs gridless tails, chip+log, live-press proven) | **deep (CQ: both forks + resurrection detour)** | `MonsterCardModal.jsx lionProximityUnmeasuredTail/lionProximityWasMeasured` — f1deeb510 VERIFIED, row fresh 2026-11-04 CQ |
| Corona/Duplicity sync-lane faces (gridless leniency, grant/enemies lists, damage-type gates, studied pre-emption) | **deep (CQ: first descent, 7 faces) — NEW BUG: corona attack-lane misplacement** | `contextBuilder-sync.js resolveCoronaAura/resolveDuplicityAura + coronaAuraUtils.js duplicityAuraUtils.js` — bug-corona-save-disadv-applied-to-attack-roll.md |
| Corona save-lane (the RAW-correct axis via handleNpcSaveDamage:110) | shallow (static-confirmed awaited; never live-proven) | `src/hooks/combat/handlers/handleNpcSaveDamage.js` — next-run PT4 |
| OA enforcement denied-on-sticky (reaction-spent 2nd departure, toast persist+dismiss, log/popup identity) | **deep (CQ face set complete: trigger/denied/sticky/dismiss/economy)** | `opportunityTrigger.js triggerDefender + MapNoticeToast.jsx` — 4fea52414 family CLOSED |
| Friendly-fire confirm (explicit-list requirement, dismiss-abort/accept-arm faces, audit row) | deep (CQ re-ride both faces; CK/CL deep UI descent stands) | `createCreatureHandlers.js handleTargetChange + useAllySelection.js` |
| Seed-quick-create modals (role=dialog a11y tier, defaults, trio-disable, cancel) | **deep (CQ post-f07304b66 both modals — supersedes CP chrome row)** | `CampaignSelection.jsx SeededCampaignModal.jsx` |
| Campaign typed-name delete + success toast (mismatch inline alert, exact→silent reload→`.success-message` one-shot, ghost 404, zero native dialogs full flow) | **deep (CQ on BOTH throwaways post-efa2d311a)** | `CampaignAdmin.jsx DeleteCampaignModal + CampaignSelection postDeleteNotice` |
| Arena + Starter seeded lanes (arena views-hidden/maps, starter checklist ×10, settlement gen, wizard auto-open) | deep (CQ re-rode both throwaways; CO deep entity/quest/POI audit stands) | `CampaignSelection starterSeed arenaStarterSeed server/routes/campaigns-*` |
| Map activate/`activeMaps` memory/no-deactivate + `__map__` mirror resurrection | **deep (CQ — true-gridless ritual codified)** | `server/routes/maps.js MapContextSync.jsx App.jsx` |
| EB join fan-out + initiative-row target-select arming + `.attacks` sheet presses | deep (CQ re-saw every lane) | `encounterToInitiative.js initiative/ char-sheet/` |
| Wolf/lion measured faces, PC-lane threading, chip parity, cover legs | carried — event-clear since CO/CP (post-CP batches touched none of those paths) | rows as dated CO/CP |
| GM map-context adoption (Activate/Open/delete/re-arm) | deep (CN matrix; CP cycles) — event-clear | `App.jsx MapsManager.jsx` |
| LAN player map views | deep (CN all 3 faces) — event-clear | rows as dated CN |
| Spell-overlay / victory / TV / delegation / allies-editor-UI / fog / hex3D / inventory / music / rules tray / NPC-quest-faction-settlement CRUD / AI lanes / PowW producer / save-prompt lifecycle | carried — event-clear at CQ (post-CP commit file lists touched none of these paths) | rows as dated CI/BH/BG/CK/CL/CM/CN/CO |

## Baseline Fingerprints (canonical test-campaign state at CQ exit — verified 2026-11-04)

- change-data `{}` + log `[]` (closed-tab, campaign-prefixed admin clears, post map-restore + API restart); in-memory `activeMaps` null-reset.
- maps [Battle Arena, Test Map]; battle-arena md5 **94fcd0bfe9e4cf6e1118f736b920e7a2** (`cp` from `dist/campaigns/test-campaign/maps/battle-arena.json`). git porcelain `public/campaigns/` EMPTY.
- campaigns/ = 5 baseline folders (qa-arena + qa-starter created, exercised, DELETED via the React modal; ghost GET 404; no re-materialization; zero lock denials server-wide).
- npcs [Marta Copperkettle]; ZERO character-file writes; 13 char files untouched. Winged Kobold removed by admin clear (combatSummary absent).
- Env at exit: dev pair running (API restarted :80 with CAMPAIGN_LOCK, vite :5173 --host); browser tab CLOSED. Console census: 1 error (self-inflicted id-less token). Logs: /tmp/dnd-api-cq.log, /tmp/dnd-vite-cq.log.
- Bug files this run: 1 (`bug-corona-save-disadv-applied-to-attack-roll.md`).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them (DONE/BLOCKED/skipped are recorded in the run summary, never left as markers). FAILED bullets stay open. -->

- 2026-11-04 CQ: friendly-fire confirm is the last surviving native `window.confirm` on a core combat lane (bfdd2e7ef migrated admin delete off native chains; CN-era runs pushed the same direction). A dismiss gives zero feedback beyond the select reverting — an inline `DeleteConfirmModal`-tier overlay (role=dialog) with the same copy would match the modern pattern and be testable without the dialog-wedge dance. `src/components/initiative/createCreatureHandlers.js:289-299`.
- 2026-11-04 CQ: full-doc map PUT accepts `players[]` entries without `id` — editor then mounts with React duplicate-key errors (self-triggered via API rig, but GM-side import/clone paths could produce the same). Normalize (assign lowercased-name id) on save or on load. `server/routes/maps.js` PUT lane / `Map.jsx` Players render.
- 2026-11-04 CQ (minor, non-blocking): `POST /api/campaigns/:c/campaign` 400 message says "Use /api/campaigns/:campaign/:key for campaign-level data" — technically correct but the de-dupe could name the offending keys' correct route family (enforcement/aiConfig top-level precedent now twice documented). `server/routes/campaigns-changedata.js`.

## Blocked / Deepen Targets (fold-gate ledger)

- CLOSED at CQ: PT1 (corona/duplicity sync-lane — 7 live faces, produced bug-corona-save-disadv-applied-to-attack-roll.md); PT2 (OA denied-on-sticky — full face set incl. dismiss); CP backlog copy nit (f1deeb510 both forks re-verified); backlog a11y note (f07304b66 role=dialog tier live); delete-success-toast + both throwaway lanes re-derived post-efa2d311a; friendly-fire/ally-consumer re-ride.
- OPEN (new→carried): corona TRUE save-lane live face (PT4 — correct axis never live-proven); corona map-active attack twin (only if fix lands); Allies-editor-UI re-entry if a fresh lane is wanted (event-clear); llama.cpp-style refusing backend for jsonSchema:true (infra, unchanged).
- DEFERRED (low value): 3D per-mesh geometry; hex travel-in-3D patch rigs; indoor overlay wand-drag face; Lion "another Barbarian with this option" exemption.
