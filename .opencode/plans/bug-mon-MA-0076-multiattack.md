# Bug MA-0076 — Adult Bronze Dragon · Multiattack (spell half inert; (A) half live)

**Verdict: FAIL.** Multiattack is display-only prose; its (A) Repulsion Breath component is live+exact, but the named SPELL cast — "Spellcasting to cast Guiding Bolt (level 2 version)" — has zero cast path. PASS would require per-spell casting of Guiding Bolt; not present. MA-0033/0065 bar reproduced.

## Live halves (work as intended)

- **Rend — LIVE + EXACT**: click "+12" link → attack popup `d20[10] +12 = 22 vs AC 19 ✓ HIT`; damage `2d8+7 = [8,7]+7 = 22` Slashing + `1d10 = 1` Lightning; `hp_change −23` (250→227) server-confirmed with per-type breakdown. Log entries `roll/attack "Rend"` + `hp_change` present.
- **Repulsion Breath — LIVE**: "DC 19 Strength" save link clickable → `.sp-modal` "ElderPaladin must make a STRENGTH saving throw. DC 19". Roll: d20[15] +10 = 25 vs DC 19 → SUCCESS. Log: `save_result` {saveDc: 19, saveType: "Strength", success: true, total: 25} + named roll "Repulsion Breath". DC/type/effect all exact.
  - Clause gaps (expected, damageless push): popup boilerplate says "Half damage on successful save" — wrong for a no-damage push/Prone effect. Push-distance ("up to 60 feet") has no mechanism; Prone application unexercisable this run (quick-roll succeeded; forced-low rolls not available in quick-roll modal). No `conditions`/`targetEffects` written on success (correct), but no fail-branch producer verifiable.

## FAIL: Guiding Bolt named, zero cast path

1. **Multiattack row inert** (`mc-action` index 2): prose only, no controls — "three Rend attacks… replace one with (A) Repulsion Breath or (B) Spellcasting to cast **Guiding Bolt**" cannot be executed as written; no attack counter, no replacement selector.
2. **Spellcasting collapses to block save** (MV-3/MV-5 fingerprint): the only affordance is one generic `mc-dice-link-save-clickable` "DC 17 Charisma". Click → boilerplate `.sp-modal` "CHARISMA saving throw / DC 17 / Half damage" — no spell name, level, school, or source. Guiding Bolt is a ranged spell **attack** (+10 to hit, not a save) — the block link models it as a save.
3. **Spell names inert `<em>`**: forced pointer + `.click()` ×2 on 4 spell `<em>`s (Guiding Bolt ×2 incl. legendary "Guiding Light", Shapechange, Detect Magic): modals 1→1 (only pre-existing block modal), no cast UI, no targeting, no slot/HP change.
4. **Grep-zero consumers**: `guiding_bolt`/`guidingBolt` non-test src/server = 0 hits (closest: `npcGenerator.js:46` flavor-name list — not a monster cast consumer). `guiding` grep of combat services + campaign runtime data = 0. Log post-session: 9 entries, `guiding` mentions = 0. `guiding-bolt` exists in 5e/2024 spells.json but nothing routes the dragon's Spellcasting into the cast pipeline.
5. **Block-roll generic**: block-link CHA roll logged as `roll/save "CHA"` — zero spell attribution; no spell slot consumption, no "1/Day"/"At Will" gating anywhere.

## Cleanup
- Admin `clear-change-data` + `clear-log` POSTs (Host: localhost). Browser closed. No manifest/playbook edits.
