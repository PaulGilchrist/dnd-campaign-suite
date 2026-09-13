# bug-mon-MA-0087 — Adult Copper Dragon Multiattack: Mind Spike uncastable; Slowing Breath never applies slowed

Row MA-0087: "three Rend attacks; replace one with (A) Slowing Breath or (B) Spellcasting to cast Mind Spike (lv4)."

## Live halves (working, verified 2026-09-13, test-campaign, ElderPaladin AC 19 target)
- Multiattack descriptor: inert text row (acceptable descriptor).
- Rend "+11" link: live and exact — HIT 28 vs AC 19; 2d10+6=[10,8]+6=24 Slashing + 1d8[7] Acid = 31; hp_change −31 (224→193).
- Slowing Breath "DC 18 Constitution": live save prompt; save resolves and logs (rolled 5+10=15 → SAVE FAILURE, save_result entry).

## Failures
1. **Mind Spike zero cast path (FAIL criterion)**: Spellcasting row renders only a generic "DC 17 Charisma" save-roll link (MonsterAction.jsx ActionSaveRoll via save_dc metadata). No spell list UI, no spell selection, no damage/effect application for any of the 7 listed spells. `grep -rn "mind_spike|Mind Spike" src/ server/` → zero consumers. Legendary Mind Jolt ("cast Mind Spike lv4") is inert text too. The named spell of the row is unreachable in UI and automation.
2. **Slowed condition never applied (MV-27)**: after failed CON save, 0 condition-applying log entries, 0 badges on target row. Cause: `extractConditionsFromSaveEffect` CONDITIONS list (src/components/encounter/MonsterCardHelpers.js:36) omits 'slowed', and Slowing Breath save_effect text ("can't take Reactions; Speed halved; action or Bonus Action") never contains the literal word "slowed" → saveConditions=[] passed to rollSavingThrow. Half-speed / no-reaction / action-cap riders unenforced.
3. **Minor drift**: save prompt shows "Half damage on successful save" for a zero-damage effect (handleSaveRoll hardcodes dcSuccess:'half', MonsterCardModal.jsx:593).

## Fix sketch
- Spellcasting: render per-spell cast links (or chooser modal) wired to a Mind Spike lv4 handler (8d8 psychic, no save; concentration).
- Add explicit save_effect→targetEffect mapping (e.g. slowed riders) instead of regex-on-literal-word; add 'slowed' to CONDITIONS.
- Gate "half damage" boilerplate on presence of a damage formula.
