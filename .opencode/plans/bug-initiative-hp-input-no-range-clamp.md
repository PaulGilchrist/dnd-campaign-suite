# Bug: Initiative GM HP input accepts any out-of-range value — HP 99/7 and HP −3/7 persist to combatSummary with no clamp, no death logic, and a broken card readout

## Summary
The per-creature HP spinbutton on Initiative cards writes whatever number the GM types straight into the shared combatSummary — including values above maxHp and NEGATIVE values. A monster at −3 HP is not dead, not unconscious, not flagged; it sits at negative HP with full actions available, and its card's HP display renders blank/garbage.

## Steps to reproduce
1. In `test-campaign`, on the Encounters page search `Goblin` (matches name OR subtype), tick `Select Goblin`, bump quantity to 2, click **Join Encounter** → auto-navigates to Initiative with `Goblin 1`/`Goblin 2` (7 HP each).
2. On Goblin 1's card set `input[aria-label="Goblin 1 current HP"]` to `99`, press Enter.
3. GET `/api/campaigns/test-campaign/combatSummary` → Goblin 1 reads `currentHp: 99` with `maxHp: 7`.
4. Set the same input to `-3`, press Enter.
5. Re-GET combatSummary → `currentHp: -3`. Card DOM shows `HP | / |` (empty readout, no digits, no dead/unconscious state).
6. Re-read `/api/campaigns/test-campaign/log` → NO `hp_change` entry for either edit (only the join row + two initiative rolls).

## Expected behavior
- Values above maxHp should clamp to maxHp (the documented GM-fill trick at most deserves an advisory, not silent 99/7 which corrupts every later half-damage/inspection read against a 7 HP stat block).
- A value ≤ 0 should route through the existing damage/death model (dead or dying at 0, per the app's own applyDamage clamps) or at minimum clamp to 0 and mark the creature defeated.
- HP overrides should log (per repo rule "every automation must log"; prior-owning playbook note "GM HP display lies — judge by hp_change log delta" implies hp_change is the intended audit channel — this lane emits none).

## Actual behavior
`currentHp: 99 / maxHp: 7` and `currentHp: -3` persist verbatim into the shared combatSummary broadcast to all clients. No console errors, no toast, no clamp, no log row. The initiative card itself renders a broken `HP /` readout for the negative value. Downstream math that trusts `currentHp` (half-damage, threshold-kill clauses like `hp_threshold_kill`, dead-target filtering) now consumes impossible numbers.

## Likely location
The HP edit handler on Initiative creature cards — `src/components/initiative/` (the card component owning `input[aria-label="<Name> current HP"]`; playbook §2 records this input "writes cs" directly). Confident it is a client-side missing range guard; the server `/combatSummary` POST lane stores whatever arrives (playbook §124 documents the same free-write, e.g. maxHp=999 stamps). Guessing the client handler passes the parsed int through without `Math.max(0, Math.min(max, n))`.

## Suggested fix
In the card HP input commit handler: clamp to `[0, maxHp]` for monsters (players may legitimately show temp-HP overshoot — check the PC lane before touching it), and when the committed value hits 0, apply the same defeated-state semantics a damage kill uses (or at least mark `currentHp:0`). Add an `hp_change` log entry describing the manual override (type/source GM-adjust) so the audit channel exists. Pin both legs with a component test.

## Severity
Data integrity risk — impossible HP states propagate to every client via SSE and poison all HP-trusting resolvers; the negative-HP "un-dead" monster is directly exploitable mid-combat (the −3 Goblin can still take its turn with full actions).
