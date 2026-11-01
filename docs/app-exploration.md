# App Exploration Map

**DESCENT RUN AV — 2026-11-01 (same-day post-AU descent: the five post-AU commits forced event-driven re-entry, and AV closed AU Targets 1/3/4/5 live).** AV verified **5840e87c0 approve-all batch errors** with a deterministic fetch-spy conflict (accumulated banner verbatim, mid-loop 409 no longer erased), re-derived the **relocated Music view** (26e72d435) end-to-end — 1 bug filed — light-re-walked **EB** (test-only a3b35d00a; Goblin join lane live), re-walked the **dice-tray LAN mirror** (Target 3) incl. the new GM-only Music-nav suppression, proved the **autopilot referee auto-apply** lane on a fresh fake rig (Target 4: `Applied: AasimarTest: 50 → 43 HP`, zero clicks), and walked the **world quest_draft fabricated-reference** face (Target 5: lands as designed → backlog, not bug). Row markers: **(live AV)** = re-derived this run; **(live AU/AT/AR/AS)** = earlier cycles; **(event-clear)** = no commits on the row's paths since its live date.

**Freshness rule (unchanged):** before trusting a Coverage row for an area you ENTER, `git log --since="<row date>" --oneline -- <paths>`; commits the row doesn't account for ⇒ re-derive live. AV entered because 5840e87c0 (drafts), 26e72d435 (music/sidebar/App), a3b35d00a (EB tests), 9a99169e9 (sseClient test-export only — no action), and the combat-service dedupe folds (brutalStrikeGrants/massHealSpellFactory/wakeOnDamageShake/sanctuarySave — CLA/MA suite ground, not exploration rows) landed after AU's map.

**qa-temp exception (owner ruling, 2026-10-29):** exactly ONE throwaway campaign named `qa-temp` may be created/exercised/deleted for cross-campaign seams. All other campaigns PRODUCTION. `POST /api/campaigns` 403s while `CAMPAIGN_LOCK` is set.

## Priority Targets (next descent)

1. **Referee Override-HP CHANGE leg** — AU proved the input renders prefilled "−7" under the confirm face; actually EDITING the override value and applying is un-walked (cheap on the AV fake rig, playbook AV §).
2. **Cross-kind approve-all accumulation** — 5840e87c0 batches per kind; the header "Approve all (n)" fires one `approveAll` per kind CONCURRENTLY and merges via functional `setError(prev => …)`. One-faction-fail + one-quest-fail batch → two concatenated sentences in one banner is code-read, never live. AV rig extends trivially (two kinds held).
3. **`jsonSchema:true` vs a refusing backend** — STILL owed (unchanged since AQ): no llama.cpp-style refusing backend on this machine.
4. **NPC director autopilot turn seam LIVE** — AiDirectorPanel auto-asks once per NPC turn and auto-stamps safe intents; unit-proven, but a live fake-rig face (director route, not referee route) is un-walked.
5. **Fog-of-war / maps deep re-entry** — event-clear since AS/AO; descend if any commit touches `src/components/maps-manager/` or fog services.

## Depth Seeds (live 2026-11-01 AV unless noted)

- **Approve-all accumulated banner (5840e87c0, live AV):** two draft factions, fetch-spy holds batch POST #1 while a :80 winner re-stamps victim row1 (echo-current-stamps + content edit). Banner verbatim: `1 of 2 factions rows failed — they were NOT saved: “QA AV One”: Faction "QA AV One" was modified in another tab … it was NOT saved.` — survives the post-loop SSE reloads ≥4s, clears on next gesture; failing row stays actionable DRAFT, sibling promoted exactly once, Iron Consortium stamp 1793127696761 byte-unchanged through inject/race/delete. Console honest: 409 resource line + `[CampaignBuilder] factions action failed` with stack. AU's single-row mid-loop contract (e1f282a42) still holds — batch deferError path is additive.
- **Music view (26e72d435 relocation, live AV):** GM-only nav 'Music' (between Maps and Notes; `localhostOnly` — ABSENT on LAN-origin tab ✓). Mood grid renders A–Z (Combat/Dungeon/Outdoors/Tavern/Town). **Mood click auto-plays** (`playing:true` by design) + `set_ambience` log with track title. Editor: live validation hint ("No valid tracks yet — paste YouTube URLs or video ids" → "N valid tracks"); zero-valid Save = leaf-inline `.music-editor-error`, editor stays, no write; dirty Cancel = NAMED confirm (AV proved it — but it named the WRONG mood → bug-music-editor-wrong-mood-default: `editMood` defaults `MOODS[0]='town'`, never syncs to active mood; save misfiles into `overrides.town` while Tavern plays; mood `<select>` escape hatch works, has no aria-label). Queue-exhausted lane honest: bogus id save while playing → toast "No playable tracks for Tavern ambience" + `no_playable_tracks` log naming failed ids + mood auto-unarmed. Remote adoption: POST /:c/music {value} from OUTSIDE the tab → ≤2.5s the tab adopts mood (Combat active) and renders `.music-remote-note` "Playing in another window" iff `playing && !playerMounted`; `playing:false` remote writes render nothing (by design); adoption effect early-returns when tab has no mounted player. Route POST merges (overrides survive a mood-only body).
- **Autopilot referee lane (Target 4 CLOSED, live AV):** aiConfig mode=autopilot via API live-renders in open Admin tab (badge copy "qa-av-fake-model · autopilot"). QAAUTOHP ask (expression 2d6+1, amount −7, target AasimarTest, HP seeded 50) → card AUTO-CONFIRMS: notice "Applied: AasimarTest: 50 → 43 HP", change-data `currentHitPoints:43`, `ai_ruling`(attempts:1)+`ai_ruling_applied` pair with exact chain copy, NO Confirm button ever offered. Actor combobox re-confirmed: "(none)" first, default stays characters[0]. needs_human still dismiss-only even in autopilot (unit-pinned :374).
- **World quest_draft fabricated refs (Target 5 CLOSED, live AV):** card copy validates first-try (attempts:1) — `validateWorldProposal` quest_draft checker = name ≤120 + description + optional rewards ONLY; allow-lists (settlements/NPCs) never consulted for this kind. Apply "Add quest to ledger" → quests row uuid+active+`notes:'AI-drafted — confirmed by the referee'` with "Nobody McFakeface"/"Nowhere-on-Sea" verbatim in prose. References are prose-only (no structural field to corrupt) → honest surface; scrutiny gap → BACKLOG. Card remains visible after apply (cosmetic, `cardAfter` true) → BACKLOG.
- **Dice tray LAN mirror (Target 3 CLOSED, live AV):** GM sidebar tray 'Roll d20' → server `roll` row (rolls:[9] total 9) AND live top-row mirror in LAN player Log "GM | Dice Tray d20 | 9" (no reload); AI audit rows and music rows mirrored LAN too. LAN nav = Campaigns/Characters/Initiative/Inventory/Log/Map(playerLabel)/Notes/Rules + tray; GM-only items (Music, Drafts, Encounters, Factions, NPCs, Quests, Sessions, Settlements, Admin) suppressed. Log DOM: entries emit as paired nodes (label row + message row) under my queried selector — anchor tests on the container.
- **EB light re-walk (live AV):** search 'Goblin' honest (Bugbears share Goblinoid TYPE — not a filter defect); `input[aria-label="Select Goblin"]` first-click checked=true; Join Encounter → auto-nav to Initiative, cs = 13-PC skeleton + 'Goblin' (unsuffixed qty1); board cleanup via admin clear only (no per-creature removal needed). a3b35d00a was test-files-only (6×1-line mocks).
- Campaign backup/restore/rename, aiConfig validator, needs_human both generations, hp_change provenance refusal, (No actor) lane, banner-persistence, drafts SSE live-sync: AU/AT faces stand (event-clear; AV rode aiConfig POST + drafts sync without contradiction).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Drafts panel (SSE + races + batch errors) | deep (live 2026-11-01 AV) | `src/components/campaign-builder/CampaignBuilder.jsx src/services/campaign/draftActions.js factionsService.js` — 5840e87c0 accumulated-batch banner closed; cross-kind merge face → Target 2 |
| Referee ask-console ALL modes | deep (live 2026-11-01 AV) | `src/components/campaign-admin/AiRefereeSection.jsx src/services/ai/applyRuling.js` — autopilot auto-apply CLOSED; Override-HP CHANGE leg → Target 1 |
| World keeper (6 kinds) | deep (live 2026-11-01 AV) | `src/components/campaign-admin/AiWorldConsole.jsx server/services/ai/schemas.js` — quest_draft fabricated-refs CLOSED (backlog); needs_human (AU) event-clear |
| Music view (relocated) | deep (live 2026-11-01 AV) | `src/components/music/MusicPlayer.jsx src/components/sidebar/Sidebar.jsx` — full panel walk, 1 bug filed (wrong-mood editor default) |
| Dice tray (GM) + LAN mirror | deep (live 2026-11-01 AV) | `src/components/sidebar/DiceTray.jsx Sidebar.jsx` — LAN mirror face CLOSED (was pm-era) |
| LAN player view | deep (live 2026-11-01 AV) | nav suppression set incl. new Music item |
| Encounters/EB | live AV (light) + AR/AP deep faces | `src/components/encounter/` — join lane re-proven; save/load/generator faces not re-walked (test-only commit) |
| Campaign admin (download/upload/rollback/rename) | deep (live AU) event-clear | `server/routes/campaigns-admin.js` — AV only touched Admin view surface |
| aiConfig UI + validator | deep (live AU; AV rode API flips) | `src/components/campaign-admin/AiConfigRow.jsx` |
| Factions CRUD + conflict lanes | deep (live AV re-inject/race/delete) | `server/utils/jsonEntityCrud.js` — re-injection with stale stamp 409s the RAW lane too (echo-reapply recipe, playbook AV §) |
| NPCs/Quests/Settlements CRUD + ct-lanes | live AQ/AP/AR | quests row DELETED via id-DELETE again; npcs/settlements rows event-clear |
| Log view (labels/search) | deep (live AT; AV rode labels) | `src/components/log/Log.jsx` — ai_world(_applied)/ai_ruling(_applied)/roll/music labels live-correct |
| AI designer chat/plan/generate | live AR/AQ + improve-proven | faces event-clear |
| Maps list/view/AI-Dress, fog | live 2026-10-31 AS | not entered AV → Target 5 if touched |
| Enforcement section | live AQ/AP/AR | untouched AV |
| SSE sync (general), rests, death saves, EffectAdder, hex travel, spell overlays, wizard, player view, inventory, rules | carried — event-clear | AV rode SSE heavily (drafts/music/log/aiConfig) — zero regression; `git log --since 2026-10-31` on those paths = AU/AV-accounted commits only (9a99169e9 sseClient = test-export deletion) |
| NPC director (Initiative) | live AQ; AV: unit-facts noted | autopilot turn seam LIVE → Target 4 |

## Baseline Fingerprints (canonical test-campaign state at AV exit — verified 2026-11-01)

- change-data `{}` + log `[]` + combatSummary null GET-verified two-pass from closed-tab quiet; runtime data files UNLINKED (canonical post-clear shape); aiConfig gone with the clear.
- Factions [The Iron Consortium] stamp 1793127696761 byte-unchanged (inject×2/race/delete cycle); quests [The Lost Artifact] stamp 1793133681292 byte-unchanged (ghost-quest apply/DELETE cycle); npcs [Marta Copperkettle]; sessions []; encounters 31; all 13 char files untouched (no sheet opened; AasimarTest HP rig was change-data-only, wiped by clear — bucket re-merged full runtime defaults at apply time, known full-store behavior).
- Maps list [Battle Arena, Test Map]; map files not entered AV (md5 carried from AU: 94fcd0bf…/8e40779e…).
- Snapshots unchanged (cap-4: 11-01T13-23, 10-31T22-40/22-02/22-01).
- Roster 5; dev:locked whole run; **lock denials 0**; zero off-target traffic; zero character-file writes; console errors this session = the deliberate 409 pair + YT third-party CORS noise (doubleclick blocked) + leaf-inline save rejection.
- QA rig files left (gitignored): `.playwright-mcp/qa-fake-model-server-av.mjs` + `qa-fake-model-av.jsonl` (rig killed at exit); repo `git status` clean; dev log /tmp/dnd-dev-av.log.

## Improvement Backlog

## Blocked / Deepen Targets (fold-gate ledger)

- OPEN (infra): llama.cpp-style refusing-backend face for constrained decoding fallback — no such backend on this machine (unchanged since AQ).
- OPEN (infra, refreshed AS): oMLX + Qwen-mtp grammar-echo degeneration family — AV sidestepped entirely with the fake rig.
- CLOSED this run: AU Target 1 (approve-all mid-loop erase — fix 5840e87c0 verified live with accumulated banner), Target 3 (dice-tray LAN mirror re-walk incl. LAN nav suppression), Target 4 (autopilot hp_change auto-apply on fake rig), Target 5 (world quest_draft fabricated NPC ref — lands by design, backlog logged). Music coverage folded from carried to deep; 1 new bug filed.
