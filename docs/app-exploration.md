# App Exploration Map

**DESCENT RUN AS — 2026-11-01 (run AT, improve-fix re-derivation + drafts/refine/world closure on a deterministic fake-model rig).** The owner's improve pipeline landed 4 more commits after AS's exit (22:19–22:51: referee needs_human dismiss-only gate 069a7099a, echo-hint "off"-first copy 451371c35, server-side echo no-op audit e718f068b, stat-aware referee dice via actorStats 7ee02d848) plus the double-REJECT ghost fix (12ae0b38c) and drafts-panel SSE live-sync (improve run 2026-11-01 §2175 playbook). AT re-derived **all five fix faces live** on the playbook fake-model rig (:8123, QA-marker-steered, JSONL prompt capture) and **CLOSED AR/AS Priority Targets 3, 4, 5, 6** (approve-all race, links-array refine replace, quest_draft apply face, model-authored needs_human). One live-oMLX sanity ask confirmed the actorStats lane on the real backend ("1d20+0 — INT mod 0, Arcana not proficient", conf 95%). Row markers: **(live AT)** = re-derived this run; **(live AR/AQ/AP/AS)** = earlier cycles; **(event-clear)** = no commits on the row's paths since its live date.

**Freshness rule (unchanged):** before trusting a Coverage row for an area you ENTER, `git log --since="<row date>" --oneline -- <paths>`; commits the row doesn't account for ⇒ re-derive live.

**qa-temp exception (owner ruling, 2026-10-29):** exactly ONE throwaway campaign named `qa-temp` may be created/exercised/deleted for cross-campaign seams. All other campaigns PRODUCTION. `POST /api/campaigns` 403s while `CAMPAIGN_LOCK` is set.

## Priority Targets (next descent)

1. **World-lane `needs_human`:** `WORLD_KINDS` includes it (schemas.js:173) but no run has walked the world console's needs_human card face (hidden action button per the AiWorldConsole gate AT confirmed by code-echo for the referee twin). Fake-rig steer = return `{kind:'needs_human',text:…}`.
2. **Referee hp_change under the actorStats lane:** the expression-required hp_change faces were walked pre-projection (run AI 2026-10-30); re-walk one leg on the fake rig with ACTOR STATS present (rule-2 provenance + confirm lane) — cheap since the rig pattern is proven.
3. **Campaign download/upload + rename round trip:** long-carried (event-clear since 10-31); AT left it un-entered. `qa-temp` is the sanctioned cross-campaign seam sandbox if the upload needs an alternate target.
4. **Banner-visibility race on approve-side conflicts:** see Improvement backlog (2026-11-01 AT) — next run can prove the transient window live (timing-lottery; reject-side banner survived 2.5s, approve-side cleared <200ms).
5. **`jsonSchema:true` vs a refusing backend** — STILL owed (unchanged since AQ): no llama.cpp-style refusing backend on this machine.

## Depth Seeds (live 2026-11-01 AT unless noted)

- **actorStats projection (7ee02d848 live AT):** suggest-mode dice ask on a roster PC sends `actorStats` in the POST body; recorded oMLX-compat prompt carries `ACTOR STATS (the acting character's actual stats):{…}` + the dice-composition rule line. AasimarTest projection disk-verified: mods {str0,dex2,con2,int0,wis1,cha3} (baseScore+backgroundIncrease, cap logic n/a at ≤20), PB 6, skills projected, `expertSkills` key omitted when empty. Control (API POST without actorStats): prompt byte-identical to pre-projection era (no ACTOR STATS line). **Live oMLX face:** same ask → model authored "1d20+0" WITH the correct RAW rationale (INT mod 0, Arcana non-prof → no PB) → Confirm → "Applied: 1d20+0 rolled [2] → 2". Roster combobox has NO empty-actor option — the stats-less control lane is API-only.
- **needs_human dismiss-only (069a7099a live AT):** model-authored needs_human WITH text (Target 6 CLOSED) renders label+text+explanation, confidence, and a **Dismiss-only** card — `Confirm & Apply` absent (grep of rendered DOM zero). The AR-era asymmetry vs the world console is dead.
- **Echo-refine honest audit (e718f068b live AT):** with saved `aiConfig.jsonSchema:true`, a verbatim-echoing refine (fake rig echoes the `Current <kind>:` … `\n\nGM instruction` entity block) → client keeps modal open + notice; server audits `ai_refine {kind,instruction,attempts:1,noOp:true}`; Log row reads **"Refine session … — no change proposed — the model echoed the input (no-op)"**; `.log-filter-input` "echoed" surfaces it. Non-echo replacement leg audits NO noOp key. Note: `response_format.json_schema.name=refine_session` WAS sent with jsonSchema:true even though the fake ignored it (grammar-force face confirmed).
- **Grammar-echo hint copy (451371c35 live AT):** echo notice now appends — `… try setting Decoding to "off" … ("probe" re-forces the grammar here, too)`. "off"-first copy verified rendered when stored config says jsonSchema===true; hidden otherwise (gated `aiConfig?.jsonSchema === true`).
- **Quest_draft apply face (Target 5 CLOSED, live AT):** world console kind=Quest draft + fake proposal → "Add quest to ledger" → row written to quests.json WITH uuid id, status 'active', notes 'AI-drafted — confirmed by the referee'; `ai_world` (proposed) + `ai_world_applied` (applied) audit pair; status line "Applied: quest 'QA AT Ledger Quest' added to the ledger (AI-drafted)". Cleanup: `DELETE /quests/<uuid>` 200 {success:true}.
- **Session links-array replace (Target 4 CLOSED, live AT):** unsaved-new-session form (refine enabled per 503b9944b); fake returned the entity with `links.encounters=['test-encounter']` → landed IN-FORM: Encounters link counter "1" + checklist auto-generated "test-encounter encounter saved and ready" row; discard-confirm quoted the form title, sessions.json stayed [].
- **Double-REJECT fix re-verified (12ae0b38c live AT):** same-ms two-tab reject (Promise.all stamps identical Date.now()) — loser tab shows "Faction not found" banner AND the ghost row is GONE at +2.5s (was actionable-until-next-broadcast pre-fix). Winner clean; disk single-deleted.
- **Approve-all race (Target 3 CLOSED, live AT):** both tabs same-ms "Approve all (2)" → per-row sequential loop; loser's stale approve on an already-promoted row hits **409 "… was modified in another tab … it was NOT saved"** (console), disk stays consistent (each draft promoted exactly once, no dupes/ghosts); loser panel self-heals via reload-on-error + winner SSE. Caveat: the approve-side error banner cleared <200ms (SSE-triggered reload calls `setError(null)`) — console-only honesty → BACKLOG.
- **Drafts SSE live-sync:** API-injected/removed draft rows appeared/vanished in BOTH open Drafts panels without Refresh (the drafts-panel-no-live-sync improve is live).
- **Faction id-DELETE lane:** `DELETE /factions/<id>` 200 {success:true} works for draft-promoted rows; Consortium row survived full-array re-POSTs stamp-unchanged (1793127696761 byte-identical).
- **Dice tray multi-die (live AT):** d100 → `roll|Dice Tray d100|total=72`, d12 → total=3 rows (+2 delta). LAN mirror still event-clear (pm-2026-10-24).
- **aiConfig live-flip face (live AT):** endpoint stub→oMLX swap via direct `POST /aiConfig` → `GET ai/status` re-probes reachable:true with real model list within ~2s, no reload; the four AS-cleared overrides face unchanged.

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Referee ask-console ALL modes | deep (live 2026-11-01 AT) | `src/components/campaign-admin/AiRefereeSection.jsx src/services/ai/actorStats.js server/services/ai/promptBuilder.js src/services/ai/applyRuling.js` — AT: actorStats projection (stub+control+live oMLX stat-correct ruling), model needs_human-with-text dismiss-only; AR/AQ/AS earlier faces event-clear |
| World keeper (6 kinds) | deep (live 2026-11-01 AT) | `src/components/campaign-admin/AiWorldConsole.jsx src/services/ai/applyWorldProposal.js server/services/ai/schemas.js` — quest_draft apply face (ledger row+audit pair) CLOSED this run; recap/rumor/dialogue/event (AS); world-lane needs_human card face NOT yet walked (Target 1) |
| aiConfig UI + strict validator + live-flip | deep (live 2026-11-01 AT) | `src/components/campaign-admin/AiConfigRow.jsx server/validation/keyValidators.js:180` — endpoint flip SSE-propagates, status re-probe, model dropdown requery (AR/AQ/AS) |
| AI refine faces (session hosts) | deep (live 2026-11-01 AT) | `server/services/ai/authoring/refine.js src/services/ai/proposedNoChange.js src/components/common/AiRefineButton.jsx src/components/sessions/SessionPlannerModal.jsx` — links-array replace CLOSED, server noOp audit + "off"-first hint live; echo/client-notice lanes re-proven |
| Drafts panel (SSE + races) | deep (live 2026-11-01 AT) | `src/components/campaign-builder/CampaignBuilder.jsx src/services/campaign/draftActions.js src/services/campaign/factionsService.js` — double-REJECT ghost fix re-verified, same-ms double-Approve-all 409-honesty CLOSED (Target 3), live SSE row-sync confirmed; approve-banner visibility caveat → BACKLOG |
| Log view (labels/search) | deep (live 2026-11-01 AT) | `src/components/log/Log.jsx log-utils.js` — no-op refine wording + all AI audit one-liners + outcome-search regression live |
| Dice tray (GM nav) | deep-single-tab (live 2026-11-01 AT) | d4–d100 one-click + log rows; LAN mirror NOT re-walked (pm-2026-10-24) |
| Maps list/view/AI-Dress | deep (live 2026-10-31 AS) | `src/components/maps-manager/AiDressButton.jsx server/services/ai/authoring/dressMap.js` — paths untouched by the four post-AS commits |
| AI designer chat/plan/generate + encounter-draft APPLY | live AR/AQ + improve-proven | `server/services/ai/authoring/designer.js` (83ccf0a74/556e886c0 owner-fixed, unit-covered) — faces otherwise event-clear |
| Drafts LAN invisibility | live AQ/AS / event-clear | jsonEntityCrud draft-hiding paths no commits |
| NPCs/Quests/Factions/Settlements CRUD | live AQ/AP/AT / event-clear | AT touched factions via full-array POST + id-DELETE probe rows (restored [Iron Consortium] stamp-identical) and quests (id-DELETE lane); guard/conflict lanes event-clear |
| Encounters/EB | live AR/AP / event-clear | no commits on EB paths |
| Enforcement section | live AQ/AP/AR | AT opened nothing new |
| SSE sync (general), rests, death saves, EffectAdder, hex travel, spell overlays, music, wizard, player view, inventory, rules, campaign download/upload | carried — event-clear | `git log --since 2026-10-31` on those paths shows only the AI/log/drafts commits AT itself re-derived or accounted for; download/upload now a next-descent Target 3 |
| NPC director (Initiative) | live AQ | paths untouched |

## Baseline Fingerprints (canonical test-campaign state at AT exit — verified 2026-11-01)

- change-data `{}` + log `[]` + combatSummary null GET-verified two-pass from closed-tab quiet; aiConfig GONE (cleared with change-data; AT ran suggest mode first against fake rig :8123 then live oMLX :8000, jsonSchema true during refine legs, temp 0.5 on the oMLX leg).
- Data files byte-baseline: npcs [Marta Copperkettle], quests [The Lost Artifact], factions [The Iron Consortium] (stamp 1793127696761 STILL byte-unchanged after AT's array POST + id-DELETE round trips), settlements [Ironhaven], sessions [], notes untouched, encounters 31.
- Maps: battle-arena.json md5 94fcd0bf…, test-map.json 8e40779e… (identical since AR). No design-notes.json. Maps list = [Battle Arena, Test Map].
- Snapshots (public/campaigns/.snapshots/): cap-4 set unchanged (20-15/22-01/22-02/22-40 — no designer generate ran AT).
- Campaign roster 5; dev:locked whole run; **zero lock denials** (dev-log grep-clean), zero off-target traffic. AT probe rows all deleted (qa-at-d1/d2 factions, QA AT Ledger Quest); no monsters joined; zero character-file edits; console errors this session = 2 (the deliberate race 409 + its resource line).
- QA rig files: `/private/var/folders/…/T/opencode/qa-fake-model-server-at.mjs` (+ qa-fake-model-at.jsonl prompt capture) — outside the repo, server killed at exit; repo `git status` clean.

## Improvement Backlog

(no open items)

## Blocked / Deepen Targets (fold-gate ledger)

- OPEN (infra): llama.cpp-style refusing-backend face for constrained decoding fallback — no such backend on this machine (unchanged since AQ).
- OPEN (infra, refreshed AS): oMLX + Qwen-mtp grammar-echo degeneration family. AT sidestepped it entirely with the fake-model rig for all echo/refine faces; the oMLX dice lane was clean this run. Non-MTP build would close this.
- CLOSED this run: AR/AS target 3 (approve-all race machine window — same-ms double-approve proven 409-honest, plus draft double-REJECT ghost fix re-verified live), target 4 (session links-array replace lands in-form), target 5 (world quest_draft Add-quest apply face — ledger row + audit pair), target 6 (model-authored needs_human WITH text, dismiss-only), plus the four post-AS improve faces (needs_human gate, hint copy, server noOp audit, actorStats stat-aware dice) all live-proven.
