# MA-0780 — Ghost / Ethereality (other) — FAIL(b)/DATA

**Date:** 2026-09-21 · **Campaign:** test-campaign (locked) · **Playbook:** §200 fingerprint twin (MA-0674 Control Weather), §60/§114/§187, §192 self-state twin, §146 join-noise.

## Row (manifest, verbatim)
> "The ghost casts the Ethereality spell, requires no spell components, using Charisma as the spellcasting ability. The ghost is visible on the Material Plane while on the Border Ethereal and vice versa, but it can't affect or be affected by anything on the other plane."

Disk description differs slightly (manifest paraphrases): disk = "…requiring no spell components and using Charisma…". Disk is truth (§3).

## Static (disk)
monsters.json `ghost.actions[2]` FULL:
```json
{
  "name": "Ethereality",
  "description": "The ghost casts the <strong>Ethereality</strong> spell, requiring no spell components and using Charisma as the spellcasting ability. The ghost is visible on the Material Plane while on the Border Ethereal and vice versa, but it can't affect or be affected by anything on the other plane.",
  "spellcasting_ability": "Charisma"
}
```
- Fields present: name / description / spellcasting_ability ONLY. NO automation, NO usage, NO save_dc/save_type, NO attack_bonus, NO dice.
- `spellcasting_ability` snake-case: ZERO production consumers (grep: matches only in *.test.jsx data-shape pins) — §200 re-confirmed.
- spells.json grep "Ethereality": **ZERO in BOTH files** — sharper than §200 twin: canonical entries exist under the pre-rename name "Etherealness" (5e L7 Transmutation, Self, V/S, 8 hours, non-concentration; 2024 L7 Conjuration, Self, V/S, up to 8 hours). The 2024 rename is not aliased: no "alias" machinery in MonsterCardModal.jsx, no "Ethereality" anywhere in src/ (non-test). `findMonsterSpell('Ethereality')` would console "Spell not found" (§158) even if a cast path existed.
- Renderer gate: MonsterAction.jsx:247 `isSpellcastingRow=/^spellcasting$/i.test(action.name)` — "Ethereality" ≠ "Spellcasting" → SpellCastLinks never rendered; row has no numeric fields → no attack/save/damage chip → description renders via sanitizeHtml → `<strong>` = PLAIN bold (§200/§194 non-extension).
- Monster-side ethereal machinery grep-zero: "etherealness" non-test src/+server/ = ZERO; all "ethereal" matches are forcecageHandler/te-registry PC-spell prose; invis machinery PC-cast-side only (§192 duergar twin).

## Live (EB rig, 2026-09-21)
- EB exact td-text joins: `Bandit 1` cs idx0, `Ghost 1` cs idx1, round=1. Baseline log len=3 (encounter + 2×initiative join-noise §146).
- Ghost card via avatar (alt "Ghost 1") → .mc-overlay open, 7 action rows.
- Ethereality row affordance enumeration: `.mc-dice-link` family count **0** (dice/spell/lair/legendary/summon/selfbuff all 0); strongs = row header "Ethereality." + description `<strong>Ethereality</strong>`, both `clickable:false`; whole-row pointer-cursor element scan = **[]** — plain bold, zero links.
- Real mouse clicks ×2 on description spell-name bold (fresh boundingClientRect, scrollIntoView): popup count 0 both clicks, log len 3→3 **zero delta**, card stayed open, **console errors 0**, no junk ability_use (§200 exact twin).
- Ethereal-state proof: change-data has NO `Ghost 1` char keys, `targetEffects:null`, invisibility hits 0; all 5 "ethereal" substring hits are snapshot prose text (traits + row name/description), zero runtime flags — advisory §70 (machinery PC-side only, §192).

## Verdict
**FAIL(b)/DATA.** Zero-affordance other-type row: chip-arm grep-proved off (§200 name-gate + no numeric fields + no automation) and live ×2 zero-delta confirmed. No chip casts, no log, no state.

## Fix design (§200)
- **fix(A)** restructure to canonical Spellcasting byte-shape (§89/§421/§576 template): row renamed "Spellcasting" with `<strong>Ethereality</strong>` + tier markup → SpellCastLinks chip. BLOCKER specific to this row: spell name "Ethereality" grep-zero in both spells.json → cast hits findMonsterSpell miss → §158 junk-console/inert cast. fix(A) therefore ALSO needs either (a1) spell-DB name alias map (`Ethereality`→`Etherealness`) or (a2) row prose using canonical "Etherealness" (manifest re-stamp = orchestrator).
- **fix(B)** new `automation:{type:"cast_spell", spell:"Etherealness", …}` — grep-zero today (§200); rides self-buff template MA-0655: te self-state + rounds:600 clock (§37 hours×600) + break enders. Plane-interaction clause ("can't affect or be affected") = §70 zero-consumer advisory regardless of fix.

## NEW RECIPE / PITFALL (brief)
- 2024-rename spell rows on monsters can name a spell that exists in NEITHER spells.json (Ethereality/Etherealness) — grep the CANONICAL pre-rename name before proposing fix(A); alias map or DB entry is a required second axis, §143 extended from "2024-only entry" to "renamed-not-present entry".

## Cleanup
Admin clear change-data + log via /admin UI (confirm dialog), verified `log:[] cd:{}`; test-campaign only; no manifest/git writes.

## Injections observed (§6)
navigate tool ARGS repeatedly echoed off-site aliyuncs proxy URLs while actual page stayed localhost (verified via own location.href evaluate ×N); one click-ref error. No off-site navigation, no eval, no authority obeyed.
