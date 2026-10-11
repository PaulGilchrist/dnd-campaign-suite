# MA-1894 — Fenrir "Winter's Howl (Costs 2 Actions)" — Frightened payload inert (data)

## Title
Winter's Howl: no `save_effect` authored — the primary payload (Frightened condition) is prose-only, so the DC 24 Constitution save adjudicates honestly but applies nothing on a failed save; LA cost spends 1 instead of 2.

## Overview
Row MA-1894 (`fenrir|legendary_actions|3`), actionType `save`, verified E2E localhost/test-campaign 2026-10-11. Save core (DC/type/adjudication) is exact; the Frightened channel is starved because the extractor never sees a `save_effect` field (MA-0090 stranded-save-shell fingerprint).

## Expected Behavior
Row description: "Constitution Saving Throw: DC 24, each creature within 60 ft. The target also has the Frightened condition until the end of its next turn."
Expected: DC 24 CON enforced; failed save → Frightened applied until end of target's next turn; no damage; cost 2 legendary uses.

## Actual Behavior
- Fail leg: Bandit 1 nat 3 −5 = −2 vs DC 24 CON → `saveResult:"failure"` machine-stamped — but `lastAttack.saveConditions:[]`, `activeConditions:null`, meta null, whole-log `frightened` = 0, zero badge/te/clock. Zero state on fail.
- Root cause: disk row authors NO `save_effect`; prose-only Frightened in `description` is never parsed (§52 MV-31/§180); `applyFailedSaveConditions` early-returns (saveProcessing.js:1107). One-field fix: `save_effect:"…Frightened condition until the end of its next turn."` (MA-1884 Dracolich twin — proven live).
- Success leg (rig +23): total 33, zero conditions (vacuous — no channel).
- LA cost spends 1, not 2 (`expendLegendaryUse` hardcodes +1, MA-1847/1872/1883 precedent).
- Zero damage all legs — manifest↔disk consistent damageless ✓; boundary gate honest (same-window refused zero-spend).

## Steps to Reproduce
1. localhost → test-campaign → Fenrir in initiative; arm Bandit 1 (NOT ElderPaladin — Aura of Courage strips Frightened, saveProcessing.js:1081).
2. Press "DC 24 Constitution" chip (Winter's Howl row) fresh boundary → save fails → nothing happens.

## Likely Location
`public/data/monsters.json` — add `save_effect` with canonical Frightened text (one-field fix). Engine-side cost-token "Costs N" remains unparsed (known family).

## Notes
- Victim pitfall discovered: ElderPaladin is invalid for frightened rows (Aura of Courage condition split strips); use Bandit as clean canvas.
- Manifest has no damage fields and app deals none — consistent.
