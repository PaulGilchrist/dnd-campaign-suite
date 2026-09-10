# Bug — CLA-390 Wild Resurgence: forward (spell slot → Wild Shape) latch round-pinned; zero logs

## Title
CLA-390 Wild Resurgence — forward conversion permanently blocked after first use (round pinned 1) + no automation logs on either half

## Overview
Wild Resurgence (2024 Druid lv5 BASE feature in app data — `public/data/2024/classes.json` Druid `class_levels[4].features[0]`, automation `{type:'resource_pool', conversion:'spell_slot_to_wild_shape', reverseConversion:'wild_shape_to_spell_slot', reverseRecharge:'long_rest'}`) is live through the full chain (row → `resourcePoolHandler` → `ResourcePoolModal`), and the **reverse half is exact**. But the forward half's once-per-turn latch is stamped and compared against `getCurrentCombatRound()` called WITHOUT `campaignName` in the modal, so the round is permanently pinned to 1: the **first** spell-slot→Wild-Shape conversion works exactly, but every later attempt (even at Wild Shape uses=0 in live combat round ≥2) is refused with "Already used this conversion this round." Forever, until Admin clear — nothing else resets `wildResurgenceFwdUsedRound` (grep: no rest/clear consumers; only `wildResurgenceReversedThisRest` is in LONG_REST_RESOURCES restRules-constants.js:171). This is the CLA-370 / CLA-45 round-pinned fingerprint. Additionally, neither conversion writes any campaign-log entry (AGENTS.md logging gap).

## Expected Behavior (canonical, classes.json lv5)
"Once on each of your turns, if you have no uses of Wild Shape left, you can give yourself one use by expending a spell slot (no action required). In addition, you can expend one use of Wild Shape (no action required) to give yourself a level 1 spell slot, but you can't do so again until you finish a Long Rest."

## Actual Behavior
- FORWARD first use exact: at ws=0, modal opens with slot table; picking lv2 and "Expend Level 2 Slot" → `spell_slots_level_2` 3→2, `wildShapeUses` 0→1, `wildResurgenceFwdUsedRound=1`. ✓
- FORWARD re-arm BROKEN: EB Thug joined, initiative rolled, walked to **combatSummary.round=2** (server truth; active=Wild_Sage_Druid); GM-set uses back to 0; reopened modal still shows "Already used this conversion this round." with NO Expend button — because `ResourcePoolModal.jsx:42` `getCurrentCombatRound()` (no campaignName) → `getCombatSummary(undefined)`=null → round PINNED 1 → `fwdUsedRound(1) !== 1` false forever. RAW grants this once on EACH turn. ✗
- REVERSE exact: ws 4→3, lv1 slot 3→4 (+1 capped at max), latch true; second attempt refused "Already used this conversion this Long Rest."; Long Rest nulls latch + refills (LONG_REST_RESOURCES) → conversion available again same day. ✓✓
- LOGS: both conversions produce ZERO campaign-log entries (log count unchanged across conversions; no `ability_use`). ✗ (AGENTS.md: every automation must log)

## Steps to Reproduce
1. test-campaign, host Wild_Sage_Druid (Druid lv20, rules 2024 — feature is BASE lv5, no subclass needed).
2. Open sheet → Actions row "Wild Resurgence:" (`b.clickable`) → ResourcePoolModal opens (both halves render).
3. GM counter editor ("Wild Shape Uses: N/4") → set uses 0.
4. Modal → Spell Slot → Wild Shape → radio lv2 → "Expend Level 2 Slot": lv2 −1, ws +1 (works once).
5. Encounters → Thug → Join Encounter → Initiative → roll → walk "Next →" until change-data `combatSummary.round` = 2.
6. Sheet → set Wild Shape uses 0 again → click "Wild Resurgence:" → forward section shows "Already used this conversion this round." with no button despite round=2 and ws=0. (Bug.)
7. Observe campaign log unchanged across steps 4 and 6 (no conversion logs).

## Likely Location
- `src/components/char-sheet/modals/ResourcePoolModal.jsx:42` — `getCurrentCombatRound()` must be `getCurrentCombatRound(campaignName)` (campaignName prop already in scope, line 9). CLA-370 fix pattern (auras/unbreakableMajesty.js threading).
- `handleForward`/`handleReverse` (:54,:65) — no `addEntry` log; need `ability_use` entries (CLA-359 shape).

## Notes
- Feature ownership: app data places Wild Resurgence on BASE Druid lv5 (canonical = Wildfire lv6) — judged vs app data per playbook §2; host needs no subclass change.
- Host pitfall found: this host has Magic Initiate(Cleric)→Bless free-cast grant ("Level 1 Spell [Instance 1]"), so casting Bless shows ZERO slot decrement — use Entangle (or another prepared lv1) for paid-slot probes on this host.
- FT-087 `activeConditions must be an array for caster` still fires on this host's first casts post-clear (slot paid anyway) — playbook 40.
- Change-data stamps verified via self-issued `/api/campaigns/test-campaign/change-data` + `/log` fetches only (injection-aware).
