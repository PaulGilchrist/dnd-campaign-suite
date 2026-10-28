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

## Resolution
FIXED 2026-10-28.

**What was actually wrong** (matches the "Likely location" guess, refined): the leaf input
(`CreatureHp.jsx` `CurrentHpInput`) passed `parseInt(v) || 0` straight through, and the store
writer (`createCreatureHandlers.js` `handleCreatureHpChange`) assigned `creature.currentHp =
newValue` with no range guard, no death handling, and no log. The bug file guessed the clamp
was missing in "the card component"; in fact BOTH layers were guard-free — fixed in both
(leaf clamps + echoes the committed number so the card never displays an impossible value;
handler clamps as the data guard so any other caller of the lane is protected too).

**Fix** (client-side only — the server `/combatSummary` POST lane stays free-write for the
documented API rig lanes, playbook §124/§125 "GM HP fill accepts currentHp>maxHp"):
- `src/components/initiative/createCreatureHandlers.js`
  - New helpers `monsterHpCap` (base maxHp + Aid/Heroes-Feast runtime increases — mirrors
    the card's displayed effective max), `clampMonsterCommit` (`Math.max(0, Math.min(n, cap))`,
    mirroring applyDamage's `Math.max(0, …)` death floor; max-edit third-arg lane bypasses it —
    it pre-clamps against the NEW max; rows without maxHp stay unclamped), and
    `logManualHpOverride` (emits `hp_change` in the exact damage-lane entry shape:
    `type/targetName/sourceName/delta/currentHp/maxHp/isHealing/isUnconscious` +
    `threshold:'dead'|'bloodied'` stamps mirroring `applyDamage.resolveHpThreshold`;
    `resolveOverrideThreshold`).
  - Death semantics = the app's existing monster model: `currentHp ≤ 0` IS dead (same bytes
    a damage kill writes, `applyCreatureHpDamage`); no new flag invented. SP-114
    spell-summon vanish now rides the CLAMPED value.
  - **PC lane untouched by the clamp** (temp-HP overshoot above max is legitimate sheet state;
    `writePlayerHp` semantics byte-identical) — but player card edits ALSO gain the
    `hp_change` audit row (repo rule "every automation must log"; playbook §149 "revive via
    HP input writes cs WITHOUT hp_change entry" is closed for both lanes).
- `src/components/initiative/CreatureHp.jsx` — `CurrentHpInput` clamps non-player commits to
  `[0, effectiveMax]` and echoes the clamped number back into the input (fixes the stale/blank
  card readout); player pass-through preserved.
- Dual-ruleset: no 2024 sibling — the lane is ruleset-agnostic store writing (single handler,
  `handleCreatureHpChange` grep-confirmed sole `input[aria-label="<Name> current HP"]` owner).

**Files changed:**
- `src/components/initiative/createCreatureHandlers.js` (fix)
- `src/components/initiative/CreatureHp.jsx` (fix)
- `src/components/initiative/createCreatureHandlers.hp-clamp.test.js` (NEW regression test)
- `src/components/initiative/CreatureHp.test.jsx` (leaf contract updated: NPC clamp table +
  input echo + player pass-through + aid-effective-max tests; old "negatives pass through"
  pin was the bug codified)
- `src/components/initiative/createCreatureHandlers.sp069.test.js` (added logService mock for
  the new import boundary)

**Verification:**
- Live repro BEFORE fix (test-campaign, EB join 2×Goblin): 99 → cs `currentHp:99/maxHp:7`;
  −3 → cs `currentHp:-3`; card readout `HP /`; log had zero `hp_change` rows. Bug CONFIRMED.
- Live re-verify AFTER fix: 5 → persists 5 + `hp_change` Δ−2; **99 → clamps to 7** (cs + input
  echo "7") + heal row Δ+2; **−3 → 0** (cs + echo "0") + row `delta:−7, threshold:'dead',
  isUnconscious:true, sourceName:'GM HP override'`; full-HP 99 on 7/7 = silent no-op (zero
  writes/log spam); PC lane unchanged (150>max 143 persists unclamped, audit row added).
  Goblin maxHp 7 cross-checked against `public/data/monsters.json` (hit_points 7) — bug
  file's expected clamp target confirmed canonical.
- Tests: new + leaf files 35/35 pass; touched folder `src/components/initiative` 60 files /
  456 pass; full suite 2871 files / 31903 pass (3 expected-fail, pre-existing).
  `npm run lint` exit 0 (zero warnings).
- Cleanup: Initiative Clear + admin clear-change-data/clear-log → GET-verified `{}` / `[]` /
  cs null; zero campaign-lock denials; all mutations test-campaign-only.
