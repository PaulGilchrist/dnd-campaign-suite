# Bug SP-128 — Expeditious Retreat: concentration stamp only; Dash bonus-action grant never appears

## Title
Expeditious Retreat cast tracks concentration and logs, but the core automation — a Dash bonus-action grant on each of your turns while active — has no implementation: no sheet/tracker grant row, no targetEffect injection, no Dash execution lane. Grep of components/hooks for "expeditious" = zero consumers outside the stamp service.

## Overview
Verified 2026-10-04, test-campaign, caster AberrantSorcerer (spell pre-existing in book).

## Expected Behavior
On cast and as a Bonus Action on each of your turns until spell ends: take the Dash action (a bonus-action affordance should exist while the buff is active).

## Actual Behavior
1. PASS legs: cast via Bonus Actions table → Metamagic chooser ("Cast Without Metamagic") → `concentration={spell:"Expeditious Retreat",dc:14}` on creature; slot 4→3; badge "Expeditious Retreat DC 14"; log verbatim.
2. FAIL core: post-cast sheet Bonus Actions gains NOTHING (no "Dash" row); tracker card badge-only; after initiative Next, badge persists but nothing re-offered. Not even an advisory grant row exists (§70 family requires at least a stamp — here only concentration is stamped).
3. Root cause: expeditiousRetreatService.js = stamp+log+popup only; `rg -i expeditious src/components src/hooks` zero; no retreat-specific runtime key in change-data.
4. Concentration lifecycle itself clean: Remove effect → GET concentration null, badge gone, no leak.

## Steps to Reproduce
1. test-campaign; any Sorcerer/Wizard with Expeditious Retreat; cast on self.
2. Observe Bonus Actions panel (before/after) — no Dash affordance ever; Next turn — none.

## Likely Location
- New consumer needed: while `concentration.spell==='Expeditious Retreat'`, inject bonus-action "Dash" row (CharBonusActions.jsx / panel builder) with Dash stamp + per-turn availability; or convert to a targetEffect with a real executor.

## Notes
- ER 2024 casting_time = Bonus Action (row lives in sheet BA table); Sorcerer lane inserts Metamagic chooser before execution. Admin cleared, GET-empty. Verified 2026-10-04.
