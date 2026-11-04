# Stale character sheet survives campaign switch and writes into the newly-selected campaign

## Summary
Switching campaigns in-session (Campaigns → pick another campaign) does not reset the currently-open character sheet. The previous campaign's character keeps rendering under the new campaign's header — with fully live Edit/Rest/Upload buttons — and sheet actions write the character's runtime bucket into the NEW campaign's change-data, even though that campaign has no such character (character-file route 404s).

## Steps to reproduce
1. In `test-campaign`, open any character sheet (e.g. sidebar → War_Cleric or FeyRanger). Sheet renders.
2. Click sidebar **Campaigns** (returns to campaign selection WITHOUT a page reload).
3. Click `qa-arena` (or any other campaign — one with zero characters makes it starkest).
4. Observe: the header now reads `qa-arena / ARENA BATTLE` (new campaign) but the body still shows the OLD campaign's character sheet (hit points, AC, `Short Rest`/`Long Rest` buttons). If the target campaign has zero characters, the "Create New Character" wizard auto-opens UNDERNEATH the stale sheet — both render simultaneously.
5. Cancel the wizard (×). Click **Long Rest** on the stale sheet.
6. GET `/api/campaigns/qa-arena/change-data`.

Verified live 2026-11-04 (run CR, dev pair :5173): after step 6 the response contains a full `AasimarTest` bucket (`hitPoints:143, currentHitPoints, spell_slots_level_*, shortRestHitDice:20, …`) plus `coverRefresh`, while `GET /api/campaigns/qa-arena/AasimarTest.json` returns 404 and `public/campaigns/qa-arena/` contains zero character files. Reproduced twice with two different characters: an AasimarTest Long Rest wrote the bucket (evaluate-click), and a FeyRanger Long/Short Rest opened the live `Short Rest` hit-dice modal via a real Playwright mouse click ("d10 — 17 of 17 remaining", Roll/Complete/Cancel all functional) — proving a normal user can drive the stale sheet.
Also reproduced via the quick-create lane: `New Arena Battle` → Create → entering the new campaign leaves the previously-open sheet mounted with a full button set (Edit/Delete/Upload/Download/Short Rest/Long Rest).

## Expected behavior
Campaign selection resets the view: no character from the previous campaign renders (or mutates) under the new campaign. The zero-character wizard should be the only surface for a characterless campaign.

## Actual behavior
- Stale sheet paints under the new campaign header immediately on select (no fetch for it — network log after entry shows only change-data/meta/maps/starter-seed GETs for qa-arena, zero character GETs — data comes from client memory).
- Rest actions POST the stale character's full runtime bucket into the new campaign (data-integrity bleed). With `CAMPAIGN_LOCK` unset and production campaigns, this would silently seed ghost buckets in a real campaign the character doesn't belong to.
- Zero console errors; every write returns 200.

## Likely location
`src/App.jsx` — `handleCampaignSelect` (line ~488) intentionally resets only `setCombatSummaryLoaded(false)`; the same code comment acknowledges the exact failure family ("so stale characters from the previous campaign can't render (or bleed into the new campaign's initiative roster)") but the reset stops at the initiative roster. `activeView` (App.jsx:343) / the character object backing the sheet and `useCampaignManagement.handleCampaignSelect` (`src/hooks/management/useCampaignManagement.js:17`, only sets `campaignName` + closes selection) are never reset. Confidence: high on the missing-reset; medium on which state var exactly pins the sheet (activeView vs a characters/selected mirror) — read App.jsx's activeView wiring to confirm.

## Suggested fix
On campaign select, reset the view state alongside `setCombatSummaryLoaded(false)`: clear `activeView` to the campaign's default (and any held character object), so the new campaign mounts from its own fetched data. Add a regression test: mount with campaign A + character sheet open → select campaign B → assert no `.char-sheet` until B's own data loads (and zero POSTs to B carrying A's character bucket).

## Severity
Data integrity risk — confirmed cross-campaign state bleed (ghost buckets written into a campaign that has no such character), reachable with plain sidebar clicks; only the localhost GM/first-client lane is checked, so player tabs behave identically.
