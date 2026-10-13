# Bug MA-2018 — Thunderbird "Updraft" reaction is zero-affordance inert prose (FAIL(b)/DATA)

## Title
MA-2018 — Thunderbird `reactions[0]` "Updraft": prose-only reaction row with no `automation{type,trigger,effect}` and no usage sentinel renders ZERO chips/links; no consumer anywhere arms a "forced to stop flying" trigger — FAIL(b)/DATA (MA-0658/MA-2012 family).

## Overview
`monsters.json` "Thunderbird" `reactions[0]` (disk, live-verified 2026-10-12) carries only `{name, trigger, description}` — no `automation` block, no `usage`/`uses`. Per §60 every chip path in `MonsterAction.jsx` arms off numeric/automation fields (`attack_bonus`, `save_dc`, `automation.effect`, `advisory`, `delegates_to`, recharge): with none present the row is inert by construction. Reaction machinery arms **only** via `automation.effect`: `getGatedMonsterReaction` (`MonsterCardHelpers.js:2203-2205`) reads `action.automation.effect` → `GATED_MONSTER_REACTIONS` table (:1267+) → `RAW_EVENT_GATE_RESOLVERS` (:2270-2283). Updraft resolves to `null` at every step.

## Expected
Row (verbatim): *"When the Thunderbird is forced to stop flying. — The Thunderbird immediately rises 60 ft. vertically without provoking Opportunity Attacks."*
Either (a) an armed lane: `automation:{type:"reaction",trigger:...,effect:...}` + honest RAW sentinel `usage:"At Will"` + `uses:999` with 1/round latch (MA-0006/0300/0305 pattern) rendering a pressable affordance, or (b) the honest floor: flat `advisory` + `advisory_message` carrying the RAW trigger+effect as a record-only popup (MA-1851 advisory-floor transport for check/prose reactions; MA-1944/MA-2012 twins).

## Actual
- **Live census** (test-campaign :5173, `.mc-overlay` Thunderbird 1, board TB init10/Bandit): Reactions section row text = `"Updraft. The Thunderbird immediately rises 60 ft. vertically without provoking Opportunity Attacks."` — 129 chars HTML, **0 chips, 0 `<a>`, 0 `button`, 0 `<i>`, 0 `<em>`**. Pure text.
- **Control probe**: rect-click on row text → zero popup (`[class*="popup"]` empty), log delta **0** (44→44 entries), `change-data` gained no reaction/usage keys (`reactionKeys: []`). Row click does not even close the overlay — fully inert.
- **Trigger consumer: none.** `GATED_MONSTER_REACTIONS` triggers: falling / enemy_spell_cast / takes_damage / melee_hit / targeted_by_spell / … — **no flying-stop type**. `grep -rni "stop flying|forced.*fly|flying_stop" src/` = zero consumers. `grep "updraft" src/` = **0**. `grep -rn "reactionQueue|fireReaction|triggerReaction" src/` = **0** (§406: no generic reactionQueue — only RAW_EVENT_GATE_RESOLVERS table types fire).
- **Display defect**: the `trigger` prose is **never rendered** — `MonsterAction.jsx` prints `name` + sanitized `description` only; the GM cannot even see "When the Thunderbird is forced to stop flying" on the card.
- **Economy**: `usage` absent → `formatActionUsage(action.usage)` renders nothing (live: no counter, no "(N)" text) — display-only row, display itself missing the trigger half.

## Steps to Reproduce
1. `test-campaign` on :5173; board carries Thunderbird 1 + Bandit 1 (registry: TB 490/490 init 10, round 3).
2. Click Thunderbird avatar → `.mc-overlay` → Reactions section.
3. Observe Updraft row: name + description text only, no chip/link/icon/counter; trigger line absent.
4. Rect-click the row text: no popup, no roll, no console mechanic, log unchanged (`GET /api/campaigns/test-campaign/log` delta 0).

## Likely Location
**monsters.json data drift** (one-field-class fix, zero code): `reactions[0]` lacks `advisory` + `advisory_message` that the existing advisory lane (`AdvisoryLink` in `MonsterAction.jsx`, `onAdvisoryRow` → record popup/log) already consumes. Secondary cosmetic: `MonsterAction.jsx` never renders the `trigger` field for any reaction row (GM blindness to RAW triggers).

## Notes
- §398: "forced to stop flying" trigger state and "rise 60 ft vertically without provoking Opportunity Attacks" are structurally **inexpressible** (no movement-distance subsystem, no flying-state machine, no monster-side no-OA enforcement). The honest fix is **record-only**: flat `advisory` + `advisory_message` carrying the RAW trigger+effect verbatim (MA-1851 honest-transport precedent, MA-2012 Somersault movement twin, MA-1944 Ladon pattern). Do NOT claim a movement engine.
- A RAW sentinel lane (`automation{type:"reaction",trigger:"...",effect:"..."}` + `usage:"At Will"` + `uses:999`, MA-0006/0300/0305) would require a reaction lane that arms on a flying-stop event — no such event type exists in RAW_EVENT_GATE_RESOLVERS/GATED_MONSTER_REACTIONS, so advisory floor is the honest verdict today.
- Unlike MA-2012 (active trap: spends then console.errors), Updraft is the clean §60 inert shape — strictly safer, still FAIL(b)/DATA per MA-0658 zero-affordance precedent.
- **NEW pitfall**: `trigger` prose is invisible in `.mc-overlay` for all non-gated reaction rows — census by row fields, not by card text search for trigger wording.
- **Cleanup**: board INTACT for MA-2019..2022 (legendary queue): Thunderbird 1 490/490, Bandit 1 551/999, round 3, `activeCreatureName="Thunderbird 1"`, log quiet at 44 entries, no reaction/legendary keys touched, `.mc-overlay` closed, NO admin-clear, app RUNNING on :5173.
