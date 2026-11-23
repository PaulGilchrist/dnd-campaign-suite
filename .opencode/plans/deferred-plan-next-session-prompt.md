# Next-Session Prompt — finish planning + implement the deferred Level 5 / AI / Lighting plan

Paste the block below into a fresh session of this repo.

---

You are continuing a feature line in the **D&D Campaign Suite** repo (React 19 + Express 5, plain JS, server-first state). A prior session shipped Phases 0–6 of the learnability plan (GM Copilot tips, Try-next invitations, Help drawer, Sound Owner, Nat20 flourish, staged loot reveal, initiative overflow fix — all live-verified with Playwright and merged clean). It deferred the items the owner explicitly kept for later, and wrote their detailed plan.

**Read first, in this order:**
1. `AGENTS.md` (repo root) — especially the mandatory rules: campaign lockdown (`test-campaign` only), no game timers, no backward-compat shims, server-first state, plan files ONLY in `.opencode/plans/`, read-only git.
2. `docs/app-exploration.md` — live-verification laws, current baseline fingerprints, and the open Improvement Backlog bullets (including the loot/tip stress-face regression check and the one-time flake to watch).
3. `docs/users-guide.md` §3, §8, §9 — the five levels, enforcement switches, AI promises (your copy source for plain-English UI text).
4. `.opencode/plans/deferred-level5-ai-lighting-plan.md` — THE PLAN TO EXECUTE. Its sections: **A** enforcement presets, **B** AI readiness panel (assistant, not wizard — owner undecided, present both faces if you find a real reason), **C** 2D dynamic lighting, **D** custom token art. Plus the carry-over: the Phase 4 app-wide visual-consistency sweep.

**Your job, in order:**
1. **Finish planning**: pressure-test plan file A–D against the CURRENT code (line references drift — re-verify `EnforcementSection.jsx`, `AiRefereeSection.jsx`/`AiConfigRow.jsx`, `server/routes/ai-models.js`, `useFogOfWar.js`/`lineOfSight.js`, `maps.js` token schema, `imageUtils.js` upload lane). Resolve every open decision in the plan (e.g. lighting v1 = read-only veil, no stealth wiring; preset flag matrices). Update the plan file in place until it is implementation-ready, item by item — and keep it at `.opencode/plans/deferred-level5-ai-lighting-plan.md` (NEVER the global `~/.opencode/plan` folder).
2. **Implement item A (enforcement presets)** first: presets write the existing `enforcement` key only, `Custom` auto-selects when any checkbox moves after a preset, the consequence card derives from flags and is never stored, and first-denial explainers ride the existing `gmCopilot` tips registry + key (already registered in `server/utils/changeDataKeys.js` and `src/services/automation/common/campaignKeys.js` — do not add new state lanes).
3. **Then B, D, C in that order.** For B, the app must never contact a model without a click; every check reuses existing lanes (`POST /api/ai/models`, schema validation, `applyFailureCopy.js`). For C, default the lighting toggle OFF and keep the off-state rendering byte-identical to today.

**Non-negotiables while working:**
- Start by booting the dev pair (`npm run dev`, background) and verify you are in `test-campaign` before any live action. At session end, restore the pristine baseline exactly as `docs/app-exploration.md` describes (change-data + log cleared to absent, the ten `data/*.json` md5 pins byte-exact, `git status --porcelain public/` empty, ports dark).
- Every ship gate: `npm run lint` (zero warnings) → targeted vitest → full `npm run test:run` once → `node .opencode/plans/no-timers-guard.mjs` if timers appear → **live Playwright walkthrough with screenshots** checked against the shared design kit (CreatureBadge, GMCopilot card family, session-phase pills, `.ct-*` tiers). Functional alone is not done; it must look consistent. Playwright runs on `localhost:5173` (GM) and the printed LAN IP (visitor tab) for cross-tab faces; rebuild `dist/` before verifying any LAN tab (port 80 serves the bundle).
- New campaign-level change-data keys must be registered in BOTH `server/utils/changeDataKeys.js` and `src/services/automation/common/campaignKeys.js` or their SSE echoes ghost-misroute (pinned by `campaignKeys.copilot-sound.test.js` — copy that test idiom).
- Audio: exactly one speaker (the Sound Owner lane, `soundOwner.js`) — lighting/token-art work must not add per-seat sound.
- No git write commands; never touch any campaign but `test-campaign`; one subagent at a time.
- When an item fully lands, append a dated verification note (what you lived, what stayed harness-unverifiable) to `docs/app-exploration.md` and remove finished backlog bullets only if they were consumed.

**Definition of done:** A, B, D, C each merged with green gates and live screenshots, the plan file updated with any decisions you made and why, the app baseline restored byte-exact, and any newly discovered open faces recorded in the Improvement Backlog.
