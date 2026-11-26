# App Exploration Map

**Generation started 2026-11-25 — FRESHLY FOLDED (last fold stamp 2026-11-25, e2e-improve run BD).** Prior generations: archive `docs/app-exploration-archive-2026-11-25.md` (the run-BA/BC map — grep-only reference) and older dated archives. **FRESHLY-FOLDED WARNING: per-section details below are carried claims, NOT live evidence — every subagent must re-derive per-screen detail LIVE, never trust the archive for selectors, faces, or laws.** Durable mechanics live in `docs/test-setup-playbook.md`.

- **Fold-cycle clock:** the full-cycle leg for the NEXT fold counts from THIS stamp (2026-11-25). Routine per-run header top-ups must not reset it.
- **Same-day code churn this map must respect:** TWO improve commits landed AFTER run BC's census and INVERIFY its rename-lane rows — `636aeb222` (blur is now a REVERT; Enter/Confirm are the only commit lanes; fileName-keyed guarded-close editor survives list refreshes) and `f5c6d634a` (sibling rows dim + all action buttons disable with cause title + pointerdown gesture blocker while an editor is armed). The archived map's blur-commit hazard, cross-row rearm hazard, and its Confirm/Cancel-only commit model are DEAD as described — the rename lane is DEEPEN-FIRST, not trusted.

## Baseline Fingerprints (re-proved live at e2e-improve run BD exit, 2026-11-25)

- Change-data `{}` + log `[]` + maps dir = exactly battle-arena, item-showcase, poi-showcase, test-map (none active); `battle-arena.json` md5 `94fcd0bfe9e4cf6e1118f736b920e7a2`.
- 15-char roster root aggregate (`cd public/campaigns/test-campaign && md5 -q *.json | md5 -q`) = `e41642cf9f0a43438e9a7d4cf5170010` (permanent fixtures `FixtureFighter5e` + `FixtureLandDruid` — keep forever, never edit).
- `data/npcs.json` `01bf02964323a572fc909d816cb9a623`; `data/inventory.json` `7638da675a912f7a334276a2b6624dfb`; `data/quests.json` `b22120b7455284f7e71aba367b16cddd`; `data/notes.json` `836a3fb683ad480c39ee61a68be00707`; `data/sessions.json` `d751713988987e9331980363e24189ce`; `images/` holds ONLY `ElderPaladin.png`.
- Campaign-lock law: ride the dev pair with `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'` inline (exact-match membership).
- Rename is NOT byte-neutral on legacy docs — ride rename ONLY on sandbox docs (playbook §610 area / archive Quirks law).

## Priority Targets (deepen-first)

0. **NEWLY SHIPPED — never explored (learnability/engagement backlog, shipped 2026-11-25, ALL uncommitted working-tree state):** six surfaces landed since run BD with ZERO live exploration — descend these FIRST per the roadmap-funnel law (each: happy path + edge + SSE/other-client behavior, then add Coverage rows tagged with these paths):
   - **Personalized toolbelt** — per-campaign GM show/hide of sidebar views via `campaign-meta` lane `{type, toolbelt:{hiddenViews}}`, live `campaigns-list` SSE convergence, batch-set presets, GMCopilot filtering, hidden-activeView route-guard fallback. Paths: `src/services/ui/sidebarNav.js`, `src/hooks/management/useCampaignMeta.js`, `src/components/sidebar/ToolbeltSettings.jsx`, `server/routes/campaigns-meta.js`.
   - **Chronicle view** — read-only story page composed from campaign log (whitelist include/exclude documented in header), session-grouped forward-time sections + Campaign-span bucket, Markdown export, `@media print` light face. Paths: `src/services/ui/chronicleService.js`, `src/components/chronicle/`.
   - **Offline ambience** — campaign `audio/` upload/delete lane (gmGuard, container sniff, server-minted names, supersede-prune unlink), canonical `{kind:'youtube'|'local',src,title}` rows (legacy `videoId` 400-refused), `ambiencePlayer` one-voice `<audio>`+YT arms, plus the repo-bundled CC0 pack (`public/audio/*.mp3` + `CREDITS.md`, bundled src home `/audio/<name>.mp3`, prune-skips + DELETE-refuses bundled beds). Paths: `server/routes/campaign-audio.js`, `server/utils/campaignAudio.js`, `src/hooks/ui/useMusicUploads.js`, `src/services/ui/ambiencePlayer.js`, `src/services/ui/musicConfig.js`.
   - **Print & handouts** — `src/components/handouts/` family (HandoutPreview portal = generalized ct-modal print trick, always-light paper face) + five verbs (NPC card, monster card, encounter sheet, quest board one-pager — GM notes whitelisted off paper — session one-pager); TV chip `.no-print` + TV board light print face.
   - **Token personalization** — cosmetics live in the CHARACTER RUNTIME BUCKET as `tokenCosmetics:{ringColor,hideLabel}` (NOT map-doc rows — lane trace proved indoor drags are GM-only doc PUTs and `/positioning` is vestigial); 8-color `TOKEN_PALETTE`; condition dashed-ring converged on `TokenStatusIndicators`; visitor may open own token's context menu (cosmetics only — THE OLD "visitor menu never opens" LAW IS DEAD); server `keyValidators.js` shape-wall; 3D documented-ignores; hex token face = marching-order avatar. Paths: `src/config/tokenCosmetics.{js,css}`, `src/services/maps/tokenOwnership.js`, `src/components/map/Players.jsx`, `PlayerContextMenu.jsx`.
   - **Visual-consistency pass (Item 7) amended faces** — indoor board is NOW paper-cream in light / dark in dark (one map-theme law, `#F0E8D8`); indoor toolbar WRAPS (no 1550px overflow); light disabled controls + new AA tokens; `--color-band-heading` (band ink) vs `--color-section-heading` (page ink) two-token law; wizard/gen-modal Escapes ride `useModalDismiss`/`DiscardDraftDialog` — **no native dialogs anywhere in these lanes anymore**; view labels via `getViewLabel`; F16 blue skills replaced by amber expertise star; F20 Inspiration is a ★ chip; campaign-select tiles neutralized. Re-derive all mapped rows touching these surfaces — prior screenshots/census (e.g. "toolbar clipped at 1550", "visitor 'Map' banner", dark indoor board in light) are DEAD descriptions.
1. **Maps-manager rename lane UNDER THE NEW BEHAVIOR** *(fresh code, live-unverified as a map row)* — re-derive deep on `636aeb222`+`f5c6d634a`: blur-revert legs (cross-row click, toolbar click, header click), sibling-lock census (every action button disabled + `Rename editor open on another row — confirm or cancel that rename first` title while armed), the pointerdown gesture blocker vs a REAL `page.mouse.click` (jsdom cannot reproduce the mid-gesture rearm — playbook §12), armed-row survive-a-real-SSE-refresh leg, and every close lane re-enabling siblings. Old map's rename rows are invalidated; do not carry them forward. **PT#4 keyboard-stranding verdict already lived CLEAN 2026-11-25 (key-log in git-visible run report; 24/24 sibling buttons real `disabled`) — don't re-walk, re-verify only if rename code moves.**
2. **EB refine hosts under a live model / capture-mock** *(carried — unverified since the PPP era)* — proposal→echo→Apply round-trip on the reconverged `.ct-modal` chrome. Capture-mock laws in playbook §2. Never entered by BA, BC, or BD.
3. **Blocked-ledger carries** *(owner/infra-gated)*: natural TPK→Clear→defeat-banner walk; Nature's Sanctuary/Smite cover forks; Load-seam race; Grease fail/prone leg; real-model autopilot/director/recap round-trips; `DeleteLockNote` UNLOCKED face; audible audio legs; bfcache `pageshow` lane (UNREACHABLE — open EventSource disqualifies bfcache).
4. **Never-paired surface × probe-class tuples** (carried remainders + fresh ones born of today's commits): LAN-visitor × `@media print`; spell-overlay × Admin clear × MID-AOE-CEREMONY; dual-ruleset mixed board × Admin clear; EB × 420px narrow viewport; sheet × mid-save hard reload; NEW: sibling-lock × keyboard-only navigation (Tab into a locked row — does `disabled` + pointerdown-block leave a keyboard stranded?); NEW: rename editor × second-tab concurrent SSE rename of the SAME row (cross-client rename collision face); NEW: blur-revert × victory-banner overlay dwell (two conditional UIs competing for blur).

## Depth Seeds (claims to beat — carried, unverified this generation)

- Run BC (archived): first live four-surface single-run descent — arm-deep-link full two-origin matrix; storage-event sibling-tab dismissal × partition isolation; cross-client Clear celebration via registered `lastAttack`; rename editor 6-leg honest ride. Beat it by descending NEW surfaces, not re-riding. *(carried — unverified)*
- Run BC: zero-bug run over four post-BA commits with byte-exact entry/exit census (all fixtures restored incl. a mid-run scare recovery). Beat it with the same census discipline on deeper lanes. *(carried — unverified)*
- Run BD (improve, today): 2 backlog items implemented + live-verified with PUT-census discipline and full-suite 37945/37945 green. The rename-lane evidence packs for `636aeb222`/`f5c6d634a` are in git commit bodies — mine them for seeds, verify live. *(carried — unverified)*

## Coverage

| Area | Depth | Last verified | Notes |
|---|---|---|---|
| Toolbelt (sidebar show/hide, presets, meta lane) | **not explored (shipped 2026-11-25)** | — | See Priority Target 0. Item-1 run's own verification is implement-side only — first e2e descent pending. |
| Chronicle view (+ md export, print face) | **not explored (shipped 2026-11-25)** | — | See Priority Target 0. |
| Offline ambience (uploads, bundled CC0 pack, ambiencePlayer) | **not explored (shipped 2026-11-25)** | — | See Priority Target 0. Audio legs need `--autoplay-policy=no-user-gesture-required`; offline proof = context route-block of all non-LAN hosts. |
| Print & handouts (five verbs + HandoutPreview portal + TV print face) | **not explored (shipped 2026-11-25)** | — | See Priority Target 0. Paper verdicts require REAL `page.pdf()` (emulation lies). |
| Token personalization (runtime-bucket cosmetics) | **not explored (shipped 2026-11-25)** | — | See Priority Target 0 — supersedes any prior "visitor token menu" rows. |
| All other surfaces | **not explored (this generation)** | — | Freshly folded: nothing carries deep status into this generation except what a future run re-proves live. Grep `docs/app-exploration-archive-2026-11-25.md` for prior claims (run BC rows: arm deep link, victory banner, campaign-key adoption, rename editor, PC sheet attack lane, visitor target-select, EB join, campaign select) — treat every archived claim as re-derive-live, and the rename-lane claims as DEAD where today's commits changed behavior. Item 0/6/7 visual-audit rows (baselines, F-verdicts, key-logs) lived in `.opencode/plans/visual-audit-findings.md` — consumed and retired 2026-11-25; durable laws folded here + playbook. |

## Improvement backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

## Blocked / not verified (fold stub — replaced each run)

- EB refine hosts under a live model / capture-mock (PT#2) — stays first-explore deepen.
- Blocked-ledger carries (PT#3) — owner/infra gates unchanged.
- PT#4 tuples (incl. the three NEW pairs born of today's commits) — not entered this cycle.
