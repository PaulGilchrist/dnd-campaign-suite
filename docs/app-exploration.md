# App Exploration Map

**DESCENT RUN AS — 2026-10-31 (late-night run 2, post-improve-pipeline).** AR folded earlier tonight; the owner's improve pipeline then landed 6 more commits 19:12–20:32 (designer-resume-success fix 83ccf0a74, ai_authoring/ai_dress readable rows 97cd389f5, strict aiConfig validator fecbf4c8a, grammar-echo hint d7df71884, effect-repair-picker proof 8a7b02e62, audit-outcome search 2e4453329) — **both AR-filed bugs are owner-fixed and AS re-proved the faces live.** AS re-derived LIVE: AR Priority Targets **1 (autopilot, all three faces), 4 (world-keeper npc_dialogue + downtime event), 5 (in-form replace faces), 3 (double-REJECT machine window — CLOSED with a NEW bug filed)** plus the new fix faces (strict validator 400, echo hint, readable+searchable audit rows, AI-Dress re-walk, dice tray). Row markers: **(live AS)** = re-derived this run; **(live AR/AQ/AP)** = earlier today; **(event-clear)** = no commits on the row's paths since its live date.

**Freshness rule (unchanged):** before trusting a Coverage row for an area you ENTER, `git log --since="<row date>" --oneline -- <paths>`; commits the row doesn't account for ⇒ re-derive live.

**qa-temp exception (owner ruling, 2026-10-29):** exactly ONE throwaway campaign named `qa-temp` may be created/exercised/deleted for cross-campaign seams. All other campaigns PRODUCTION. `POST /api/campaigns` 403s while `CAMPAIGN_LOCK` is set.

## Priority Targets (next descent)

1. **Autopilot + unregistered target_effect ruling:** isAtomicRuling counts target_effect as atomic ⇒ in autopilot an off-registry effect key AUTO-APPLIES past the card's repair picker (the picker is UI-only), riding the apply lane's honest refusal. Walk it live (transport-rig effect key per playbook §AS referee-rig recipe, mode=autopilot) and confirm refuse-log clarity + no badge.
2. **`jsonSchema:true` vs a refusing backend** — STILL owed (unchanged from AQ/AR): no llama.cpp-style refusing backend on this machine. AS refreshed the sibling face: probe ALSO echoes on oMLX (see Depth Seeds).
3. **Drafts Approve-all under race:** `approveAll` loops runAction sequentially; the double-approve / approve-vs-external-delete machine window unprobed (reject side now CLOSED via bug-drafts-double-reject-ghost-row).
4. **Session refine links-array replace:** AS proved name/notes/summary in-form replace + contingencies pin; a model rewrite of `links.encounters` (the schema carries it — projectSessionForRefine does NOT strip links) un-walked.
5. **World-keeper quest_draft Add-quest apply face:** AP walked reject=delete; the "Add quest to ledger" write (id-stamped row in quests.json) + its `ai_world_applied` audit un-walked live.
6. **Model-authored needs_human with text:** AS reached needs_human only via engine fallback (empty-text invalid ruling). An ask that makes the model itself propose needs_human WITH descriptive text (per promptBuilder rule 4) un-walked.

## Depth Seeds (live 2026-10-31 AS unless noted)

- **Strict aiConfig (fecbf4c8a live):** unknown top-level key → 400 naming key + known-keys list + `enforcement_denied` log row. Valid blob only accepts the 7 whitelisted keys.
- **Referee autopilot (Target 1 CLOSED, 3 faces):** dice ask → auto-applied zero-click ("Applied: 1d20 rolled [9] → 9"; pair `ai_ruling`+`ai_ruling_applied` + real `roll` row). Automation ask → card WAITS even in autopilot ("Attack with Shortsword → Goblin"); Confirm = honest refuse "run it on the action's own lane". Vague ask → engine needs_human "(invalid ruling: text required and non-empty)"; its card offers Confirm (honest refuse) — asymmetry vs world console which hides the action button for needs_human → BACKLOG.
- **World keeper (Target 4 CLOSED):** `npc_dialogue` grounded ("Marta Copperkettle: Well, look at the lot of you…" conf 82%); "Log it" → narrative row (name=Marta) + `ai_world_applied` audit. `event` (downtime) live (conf 88%, Ironhaven/Marta canon) — Dismissed proposal still audits an `ai_world` proposed-row (honest).
- **Session refine (Target 5 faces):** grammar-off apply rewrote NAME + notes fully in-form (discard-confirm quoted the model-renamed title); structured contingency row SURVIVED byte-exact — pin by design (projectSessionForRefine strips + onReplaced merge). Grammar-ON echo ⇒ no-op notice NOW carries the d7df71884 hint naming Decoding="on" (live-verified); probe ALSO echoed on oMLX (hint's "try probe" half-wrong → BACKLOG).
- **Double-REJECT race (Target 3 CLOSED, FILED):** same-ms two-tab rejects on one draft → loser 404s (`Faction not found` banner) but KEEPS the actionable ghost row (runAction catch skips reload; winner's SSE lands in busy-skip window). Server truth intact; ghost-Approve benign re-read no-op (Consortium stamp byte-unchanged); next broadcast/Refresh heals. `bug-drafts-double-reject-ghost-row.md`.
- **Log view (97cd389f5 + 2e4453329 live):** AI Dress/AI Refine/AI World/AI Ruling rows all readable one-liners incl. "applied to battle-arena 1 op"; outcome phrases searchable via `.log-filter-input`. Caveat: echo no-op refines still audit "proposed a replacement" (server can't see client echo-detect) → BACKLOG.
- **AI-Dress re-walk (live AS):** list-row "AI Dress" works (no in-VIEW needed); barrel@12,8 propose→Apply→PUT lands ai-dress-item; maps md5 94fcd0bf… restored byte-exact via placedItems:[] PUT.
- **Dice tray (live AS):** nav 'd20' face click → `GM Dice Tray d20 … 10` row (+1 log-entry delta).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Referee ask-console ALL modes | deep (live 2026-10-31 AS) | `src/components/campaign-admin/AiRefereeSection.jsx src/services/ai/applyRuling.js` — suggest (AR) + autopilot atomic/automation/needs_human faces (AS); effect-repair picker owner-proven 8a7b02e62 |
| World keeper (5 kinds) | deep (live 2026-10-31 AS) | `src/components/campaign-admin/AiWorldConsole.jsx src/services/ai/applyWorldProposal.js server/services/ai/schemas.js:173` — recap/rumor (AQ) + npc_dialogue+event apply/dismiss (AS); quest_draft apply-face owed (Target 5) |
| aiConfig UI + strict validator | deep (live 2026-10-31 AS) | `src/components/campaign-admin/AiConfigRow.jsx server/validation/keyValidators.js:179 AI_CONFIG_KEYS` — merge/tri-state/temp (AR) + 400-on-unknown-key live (AS); unknown-key hygiene note CLOSED |
| AI refine faces (session hosts) | deep (live 2026-10-31 AS) | `server/services/ai/authoring/refine.js src/components/common/AiRefineButton.jsx src/services/campaign/sessionPlannerUtils.js:132 src/components/sessions/SessionPlannerModal.jsx:233` — echo+hint, probe-echo, grammar-off in-form replace, contingencies pin; links-array replace owed (Target 4) |
| Drafts panel (SSE + races) | deep (live 2026-10-31 AS) | `src/components/campaign-builder/CampaignBuilder.jsx src/services/campaign/draftActions.js` — auto-sync create/delete (AR), reject/external-delete window (AR), TRUE simultaneous double-REJECT ghost (AS, FILED); Approve-all race owed (Target 3) |
| Log view (labels/search) | deep (live 2026-10-31 AS) | `src/components/log/Log.jsx log-utils.js` — readable ai_dress/ai_refine/ai_world/ai_ruling rows + searchable outcomes live; both AR bugs (97cd389f5/83ccf0a74) fixed-live; echo-rows-say-"proposed a replacement" wart → BACKLOG |
| Maps list/view/AI-Dress | deep (live 2026-10-31 AS) | `src/components/maps-manager/AiDressButton.jsx server/services/ai/authoring/dressMap.js` — list-row dress + apply + readable pair + md5-exact restore re-proven |
| Dice tray (GM nav) | shallow→probed (live 2026-10-31 AS) | d20 one-click roll + log row; multi-die + LAN mirror not re-walked (pm-2026-10-24 covered mirror) |
| AI designer chat/plan/generate + encounter-draft APPLY | live AR | `server/services/ai/authoring/designer.js` touched by 83ccf0a74 (resume-success audit wording only, unit-covered, AS re-verified row lane) — chat/plan/generate faces otherwise event-clear |
| Drafts LAN invisibility | live AQ / event-clear | jsonEntityCrud draft-hiding paths no AS-era commits |
| NPCs/Quests/Factions/Settlements CRUD | live AQ/AP / event-clear | AS touched factions via full-array POST/DELETE race rig (restored [Iron Consortium] stamp-identical); guard/conflict lanes event-clear |
| Encounters/EB | live AR/AP / event-clear | no AS-era commits on EB paths |
| Enforcement section | live AQ/AP/AR | AS opened nothing new here |
| SSE sync (general), rests, death saves, EffectAdder, hex travel, spell overlays, music, wizard, player view, inventory, rules, campaign download/upload | carried — event-clear | `git log --since 2026-10-31` on those paths shows only the AI/log/validator commits AS itself re-derived |
| NPC director (Initiative) | live AQ | paths untouched by the improve wave |

## Baseline Fingerprints (canonical test-campaign state at AS exit — verified 2026-10-31)

- change-data `{}` + log `[]` + combatSummary null GET-verified two-pass from closed/blank-tab quiet; aiConfig GONE (cleared with change-data; AS ran Qwen-mtp suggest→autopilot, jsonSchema absent/true/false, temperature 0.5).
- Data files byte-baseline: npcs [Marta Copperkettle], quests [The Lost Artifact], factions [The Iron Consortium] (stamp 1793127696761 — ghost-Approve no-op PROVED byte-innocuous), settlements [Ironhaven], sessions [], notes untouched, encounters 31.
- Maps: battle-arena.json md5 94fcd0bf…, test-map.json 8e40779e… (identical to AR exit; dress barrel removed pre-exit). No design-notes.json. Maps list = [Battle Arena, Test Map].
- Snapshots (public/campaigns/.snapshots/): cap-4 set unchanged from AR exit (no designer generate ran AS).
- Campaign roster 5; dev:locked whole run; **zero lock denials** (dev-log grep-clean), zero off-target traffic. AS race-draft rows qa-as-d1/d2/qa-as-ghost all deleted; no monsters joined; zero character-file edits.

## Improvement Backlog

- **2026-10-31 AS — echo no-op refines audit "proposed a replacement".** Server-side `ai_refine` rows report attempts/proposed even when the client's proposedNoChange() correctly suppressed the apply (2 of 3 AS rows were echoes). Honest per-layer, but the Log overstates model productivity; consider a client no-op audit append or server-side echo check (cheap isEqual).
- **2026-10-31 AS — referee dice rulings are stat-blind.** Model proposed +5 then raw "1d20 — Arcana check; no proficiency modifier available" — the referee ask context carries no actor ability stats, so dice rulings roll bare. Consider projecting the chosen character's relevant modifier into the ask payload (proposal stays GM-confirmed).

## Blocked / Deepen Targets (fold-gate ledger)

- OPEN (infra): llama.cpp-style refusing-backend face for constrained decoding fallback — no such backend on this machine (unchanged from AQ/AR).
- OPEN (infra, refreshed by AS): oMLX + Qwen-mtp degeneration family: grammar-ON echo CONFIRMED again + probe echo NEW this run; batch blueprint still non-JSON. App defended honestly (echo-detect + hint + fail-fast resume). Non-MTP build would close this + the refusing-backend face.
- CLOSED this run: AR target 1 (autopilot all faces live), AR target 3 machine window (double-REJECT ghost — probed + FILED), AR target 4 (world-keeper npc_dialogue + downtime live), AR target 5 links/contingencies half (contingencies pin = designed, name/notes replace live-proven; links-array replace demoted to new Target 4), AR backlog aiConfig unknown-key hygiene (fecbf4c8a live-proven 400), AR bugs ai_authoring/ai_dress raw JSON (97cd389f5 live-proven readable) + resume-success wording (83ccf0a74 unit-covered, log lane re-verified clean), AQ target 2 sibling face (echo hint live).
