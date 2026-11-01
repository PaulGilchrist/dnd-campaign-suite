# App Exploration Map

**DESCENT RUN AR — 2026-10-31 (night cycle, post-improve-pipeline).** AQ folded earlier tonight; the owner's improve pipeline then landed 9 commits 16:53–~22:00 (session-refine preflight fix a977172a2, drafts SSE aa2d9b2b7, ai-readable log rows 05973fdf1, aiConfig merge-on-save+tri-state b772daaaa, resume-keeps-drafts 556e886c0, refine-ungate 503b9944b, DraftFlag chips 953873ce9/b0a6586bf). AR re-derived every row those commits touch LIVE on a local model (oMLX :8000, **Qwen3.8-Flash-Next-oQ4e-mtp**, single model, ~8-100s/call) and closed AQ's Priority Targets **1, 2, 3(deep), 4(deep), 6(deep)**. Row markers: **(live AR)** = re-derived this run; **(live AQ/AP)** = earlier today, untouched by the 16:53+ wave except where an AR row supersedes; **(event-clear)** = no commits on the row's paths since its live date.

**Freshness rule (unchanged):** before trusting a Coverage row for an area you ENTER, `git log --since="<row date>" --oneline -- <paths>`; commits the row doesn't account for ⇒ re-derive live.

**qa-temp exception (owner ruling, 2026-10-29):** exactly ONE throwaway campaign named `qa-temp` may be created/exercised/deleted for cross-campaign seams. All other campaigns PRODUCTION. `POST /api/campaigns` 403s while `CAMPAIGN_LOCK` is set.

## Priority Targets (next descent)

1. **Referee autopilot mode face:** AR walked suggest-mode ask→propose→Confirm (dice + hp with override + effect-repair picker code-present). autopilot auto-apply (`aiConfig.mode==='autopilot' && isAtomicRuling`) never asked live; automation-type rulings waiting for referee and the needs_human face also un-walked.
2. **`jsonSchema:true` vs a refusing backend** (llama.cpp-style 400 fallback) — STILL owed: no refusing backend on this machine. AR instead proved the NEW face: on Qwen-mtp, grammar-true makes refine/generate verbatim-echo the input (see Depth Seeds).
3. **Drafts reject-race under SSE:** aa2d9b2b7 re-fetch closed the two-tab stale window (AR: external DELETE won the race, row vanished before a click could land). A true simultaneous double-REJECT (two in-flight deletes) untried; approve-after-reject face only reachable by freezing reload (`busy` gate), untried.
4. **World-keeper npc_dialogue + downtime kinds** (AQ skipped both individually).
5. **Session refine AFTER a real model proposal** (AR: session face alive, edit applied to form via saved-row + unsaved-new faces; grammar-echo blocked one face, model produced no session-kind change under false-grammar for the recap-tone instruction — no-op notice honest). Full in-form replace of links/contingencies arrays un-walked.
6. **Encounters-draft refine with real content change under grammar-off** (AR applied a description edit to form + verified zero-write; save-after-refine lane = EB Update, walked byte-clean).

## Depth Seeds (live 2026-10-31 AR unless noted)

- **aiConfig UI (b772daaaa re-derived):** Decoding tri-state select (probe=absent / on=true / off=false) + Temperature number input both live; **merge-on-save**: API-set unknown key (`futureTuning:42`) SURVIVES three UI saves; probe face REMOVES `jsonSchema` key; blank temperature REMOVES `temperature`; explicit 0.5 writes number. Config POST route `/api/campaigns/:c/aiConfig` accepts arbitrary unknown keys (validator only checks known fields) — hygiene note.
- **Session refine (a977172a2 fix):** preflight DEAD confirmed cured — projection `projectSessionForRefine` strips playedAt/checklist/contingencies client-side; unsaved-NEW face works (Refine button ungated in planner, applies to live form, zero disk write until Save); saved-row face works. **`jsonSchema:true` made the model return byte-identical echo 3× in-UI + 1× curl** (server returns ok:true attempts:1 — the client `proposedNoChange()` echo-detection is the ONLY defense, and it honestly shows "model proposed no changes — the form is unchanged."); flipping Decoding off via API → same call applied the exact requested Notes edit in ~8s.
- **Drafts panel SSE (aa2d9b2b7):** external full-array POST appending a draft faction (must echo all rows — bare single-row POST 409s "Faction not found"? no: 409 conflict on missing rows echo) auto-appeared the row WITHOUT Refresh; external DELETE auto-removed it. Panel reload skips while `busy`.
- **Designer funnel w/ Qwen-mtp:** chat grounded in storyBible canon (Consortium/Marta/wards — real campaign pull); plan face ~10s even with grammar-ON (rescue confirmed for PLAN shape); batch generate died non-JSON → **fail-fast per-entity resume DRAFTED the encounter (first-ever live encounter-draft APPLY)**: snapshot-first zip, drafts-panel row "Ambush at Wolf Hollow" + draft chip, Approve → row lands in `data/encounters.json` (31→32) with selectedMonsters real bestiary pairs (bandit-deceiver, bandit-crime-lord), LAN-invisible while draft. EB Load resolves full stats (CR/XP shown, 10,100 eff XP Easy vs Lv20 party). UI Del + named confirm removed it (31 restored).
- **Referee ask-console suggest face (ecbf180cd composer):** dice ask → proposal card (type, confidence %, description, Confirm/Dismiss) → Confirm applied "1d20+5 rolled [7] → 12"; log pair `ai_ruling` + `ai_ruling_applied` readable. hp_change ask → **Override HP input pre-fills model amount; editing to -2 applied "143 → 141" with `overridden:true`** (§10.4 human-disposes proven). Effect-registry repair picker code-confirmed (unregistered `effect` key → select from TARGET_EFFECT_DEFINITIONS gates Confirm) — not hit live (model proposed valid keys).
- **AI-Dress in map view (target 4 closed):** toolbar "AI Dress" opens docked modal; instruction → 4-op proposal ("add wall at 8,10…") with preview markers mirrored onto canvas DOM via onProposalChange; Apply → PUT battle-arena lands placedItems (type:"wall" items — walls/paint/fog/image have NO dress verbs by design), logs `ai_dress` pair, markers cleared with zero residue. Restored via map PUT placedItems:[] (maps md5-identical at exit).
- **Log view (05973fdf1):** designer/refine/ruling rows now one-liners ("Refine encounter … proposed a replacement after 1 attempt", "AI ruling applied: dice …"); **residual raw-JSON leaks for `ai_authoring` and `ai_dress` types — FILED `bug-log-ai-authoring-raw-json.md`** (missing from ENTRY_COMPONENTS map). Successful resume generate says "gave up after retries" — **FILED `bug-designer-resume-success-says-gave-up.md`** (resume success audits attempts:0).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| aiConfig UI (tri-state, temp, merge) | deep (live 2026-10-31 AR) | `src/components/campaign-admin/AiConfigRow.jsx, AiRefereeSection.jsx:63 mergeAiConfig, server/validation/keyValidators.js:179` — all faces incl. key-removal semantics proven; unknown keys accepted by POST |
| AI refine faces (session-saved + session-new faces) | deep (live 2026-10-31 AR) | `server/services/ai/authoring/refine.js, src/components/common/AiRefineButton.jsx, src/services/campaign/sessionPlannerUtils.js:132` — session kind FIXED-live (was the AQ-dead face); echo-detect defense proven; other kinds = live AQ (paths unchanged except refine.js preflight strip + AiRefineButton modal, AR walked the modal via session/encounter hosts) |
| AI refine encounter face | deep (live 2026-10-31 AR) | EB row → Refine → grammar-echo no-op notice → decoding-off → description edit in-form → Cancel → **named discard confirm fires**, disk byte-clean |
| AI designer chat/plan/generate + encounter-draft APPLY | deep (live 2026-10-31 AR) | `src/components/campaign-builder/AiDesignerSection.jsx, server/routes/ai-designer.js, services/ai/authoring/designer.js+apply.js` — first-ever live encounter draft end-to-end (generate→draft→approve→EB load→delete); chat canon-grounded; plan grammar-rescue re-proven |
| Campaign Builder — Drafts panel SSE | deep (live 2026-10-31 AR) | `src/components/campaign-builder/CampaignBuilder.jsx:118, src/services/campaign/draftActions.js` — auto-refetch on external create AND delete; uuid-array approve re-read+overwrite; reject=normal delete |
| Referee ask-console (suggest mode) | deep (live 2026-10-31 AR) | `src/components/campaign-admin/AiRefereeSection.jsx AiAskConsole, src/services/ai/applyRuling.js` — dice + hp_change/override faces; autopilot + effect-repair-picker + needs_human faces un-walked (see targets) |
| Maps list/view/AI-Dress | deep (live 2026-10-31 AR) | `src/components/maps-manager/AiDressButton.jsx, server/services/ai/authoring/dressMap.js` — in-VIEW dress deep flow closed (AQ target 4); op verbs = items/portals/pois only; maps restored md5-identical |
| Log view (sinks/labels) | deep (live 2026-10-31 AR) | `src/components/log/Log.jsx ENTRY_COMPONENTS, log-utils.js formatAiAuditLine` — readable rows for designer/refine/ruling live; `ai_authoring`+`ai_dress` raw-JSON leak FILED; resume-success "gave up" FILED |
| Drafts LAN invisibility | live AQ / event-clear | jsonEntityCrud draft-hiding paths no AR commits |
| NPCs/Quests/Factions/Settlements CRUD | live AQ/AP / event-clear | AR touched factions via full-array POST/DELETE rig lanes (restored [Iron Consortium]); guard/conflict lanes event-clear |
| Encounters/EB | deep-additive (live 2026-10-31 AR) | EB Load of AI-approved encounter resolves bestiary stats; Save/Load/list/delete = live AP |
| Enforcement section | live AQ/AP | AR opened Admin repeatedly (rendered honest, master-OFF, Select-All enabled); faces event-clear |
| SSE sync (general), rests, death saves, EffectAdder, dice tray, hex travel, spell overlays, music, wizard, player view, inventory, rules, campaign download/upload | carried — event-clear | `git log --since 2026-10-31` no commits on those paths beyond AR's AI rows above (dice tray rendered in nav all session, untouched) |
| World keeper | live AQ (deep) | npc_dialogue/downtime kinds still un-asked (target 4) |
| NPC director (Initiative) | live AQ | paths untouched by the improve wave |

## Baseline Fingerprints (canonical test-campaign state at AR exit — verified 2026-10-31)

- change-data `{}` + log `[]` + combatSummary null GET-verified two-pass, tab closed BEFORE clears, zero resurrect.
- aiConfig GONE (cleared with change-data; AR ran DeepSeek-era config replaced by Qwen-mtp/suggest with jsonSchema flips + temperature 0.5 mid-run, incl. probe-key `futureTuning`).
- Data files: npcs [Marta Copperkettle], quests [The Lost Artifact], factions [The Iron Consortium], settlements [Ironhaven], sessions [] (AR's "Session 1: The Drowned Vein" API-DELETEd after the refine walks), notes/encounters(31)/inventory untouched.
- Maps: battle-arena.json md5 94fcd0bf…, test-map.json 8e40779e… (identical to AQ exit; dress-placed 4 wall items removed pre-exit). design-notes.json DELETED (AR conversation residue, same as AQ).
- Snapshots 4: 20-15 (AQ), 22-01 + 22-02 (PRE-EXISTING — pre-AR verify run w/ stub chat, do not chase), 22-40 (AR encounter generate).
- Campaign roster 5; dev:locked whole run; **zero lock denials** (server log grep-clean), zero off-target traffic.

## Improvement Backlog

## Blocked / Deepen Targets (fold-gate ledger)

- OPEN (infra): llama.cpp-style refusing-backend face for constrained decoding fallback — no such backend on this machine (unchanged from AQ).
- OPEN (infra, refreshed): oMLX + Qwen-mtp degeneration family now includes **grammar-echo** (json_schema ON ⇒ model returns verbatim input echo on refine/blueprint-repair shapes; batch blueprint still non-JSON). App defended honestly (echo-detect + fail-fast resume). Non-MTP build would close this + target 2.
- OPEN: true simultaneous double-REJECT race (two in-flight deletes) — aa2d9b2b7 auto-refetch closes the human-window; machine-window unprobed.
- CLOSED this run: AQ targets 1 (encounter-draft APPLY end-to-end), 2 (session refine both faces re-verified after a977172a2 — FIXED live), 3 (referee deep face: suggest + override applied), 4 (AI-Dress in-VIEW deep flow), 6 (reject/external-delete under new SSE sync — window closed honestly). AQ backlog: aiConfig tri-state+temperature (b772daaaa), audit-row readability (05973fdf1), drafts live-sync (aa2d9b2b7), resume-keeps-drafts (556e886c0 — the encounter draft landed via that exact lane), refine-no-op notice (re-proved), DraftFlag chips (badged live), drafts contrast (buttons legible) — ALL owner-fixed and AR re-proved live.
