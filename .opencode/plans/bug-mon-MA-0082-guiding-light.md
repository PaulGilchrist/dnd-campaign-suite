# Bug MA-0082 — Adult Bronze Dragon · "Guiding Light" (legendary_actions, other) — FAIL flavor(b)

## Row
- id: MA-0082 · stableKey: adult-bronze-dragon|legendary_actions|1
- "The dragon uses Spellcasting to cast Guiding Bolt (level 2 version)."

## Verdict: FAIL (inert + grep-zero → MV-30/MV-28 bar; spellcast-reference legendary row has zero affordance and zero producer)

## Evidence
- Static: monsters.json legendary_actions[1] carries {name, description} only — no save_dc/attack_bonus/dice/effect/te metadata. MonsterCardBody.jsx:29 renders via MonsterActionSection→MonsterAction; no-numeric legendary rows are inert .mc-action (MV-17; MV-23 exception N/A).
- Live (.mc-overlay, initiative, header test-campaign ✓ MV-18): row = DIV.mc-action, 152 B static HTML `<strong>Guiding Light.</strong> <span>…</span>`; spinbuttons=0, dice chips=0, buttons/links=0, pointer-cursor descendants=0.
- Forced click (row + inner span): change-data byte-identical pre/post (10193 B, cmp clean); row HTML unchanged; no log entry; no campaign te keys touched.
- grep: zero guiding_bolt handlers/producers app-wide (only npcGenerator.js:46 flavor spell name + tests). next_attack_advantage consumers/producers (attackPostProcessing.js:195/:241, ConditionEffectBadges.jsx:68, AttackRiderModal.jsx:10) are PC-scoped (te.target===characterName / vex) — no monster Spellcasting path applies Guiding Bolt's hit advantage ("next attack roll vs target has advantage") from this row.

## Impact
Guiding Light is unexecutable: no spell-roll, no damage, no advantage te application, no expend tracking. Cosmetic text on the monster card only.

## Notes
- Same-family fingerprint as MA-0081 (same monster legendary block); shares monster Spellcasting action absence of a generic monster-cast producer (cf. MV-11).
