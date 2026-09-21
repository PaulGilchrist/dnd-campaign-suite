# Bug MA-0674 — Elemental Cataclysm "Control Weather" (actions[3], other)

**Verdict: VERIFIED: FAIL(b) — inert zero-affordance row (DATA).**

## Canonical disk (public/data/monsters.json, Elemental Cataclysm actions[3])
```json
{
  "name": "Control Weather",
  "description": "The cataclysm casts the <strong>Control Weather</strong> spell, requiring no spell components and using Constitution as the spellcasting ability.",
  "spellcasting_ability": "Constitution"
}
```
No `type`, no `attack_bonus`, no `save_dc`, no dice, no `automation`, no zone dict. Only extra field: `spellcasting_ability`.

## Live evidence (2026-09-20, test-campaign, :5173, header-verified)
1. **DOM audit** (joined `Elemental Cataclysm 1`, card open): row renders exactly
   `<strong>Control Weather.</strong> <span>The cataclysm casts the <strong>Control Weather</strong> spell, …</span>` —
   **ZERO clickable elements**: no `.mc-dice-link`, no `.mc-dice-link-spell`, no `[role=button]`, no anchors. Both `<strong>` nodes non-clickable (no onclick, no role).
2. **Click probe** (emphasized spell name + row center): zero log delta (2→2, join noise only: `encounter` + init `roll`), zero console errors, zero popups (mc=1 itself, popup=0, sp=0).
3. **§158 fake-chip does NOT apply** — confirmed §194 twin: mid-prose `<strong>` inside a non-"Spellcasting" row renders plain bold, NOT a chip. No junk `ability_use`, no "Spell not found" console error. Cleanly inert.
4. **spells.json**: "Control Weather" EXISTS in BOTH `public/data/spells.json` and `public/data/2024/spells.json` (L8 Transmutation, 10 min, Self, V/S/M, concentration up to 8h, **ritual:false** — manifest prose "ritual" is wrong vs rule-data-is-truth §3; no combat targets, no save, no damage — zero-target spell, §70-class "no weather state modeled" advisory would be acceptable IF a cast logged).
5. **Grep consumers**: `spellcasting_ability` (snake_case monster field) — **grep-zero app-wide** (all hits are unrelated PC-side camelCase `spellcastingAbility` in FiendishLegacy/ArcaneVigor/steps). No `cast_spell` automation type exists.
6. Cleanup: admin clear-change-data + clear-log POST 200; GET verify log `[]`, change-data `{}`.

## Root cause
`MonsterAction.jsx:202`: `isSpellcastingRow = /^spellcasting$/i.test(action.name)` — XOR fork at :217 renders SpellCastLinks ONLY for rows named "Spellcasting". Row named "Control Weather" with no numeric/automation fields arms zero affordance (§60/§114/§187 family; MA-0648/0651/0658/0664 twins). The `<strong>` markup around the spell name never reaches `extractSpellNamesFromSpellcasting` because the whole SpellCastLinks branch is name-gated. `spellcasting_ability: "Constitution"` is never read anywhere (§43 'ability' DC token moot — no save path exists).

## Fix options
- **(A) DATA, minimal, reuses proven seam (recommended):** restructure row to canonical Spellcasting byte-shape (MA-0421/§89/MA-0611 template): `name:"Spellcasting"`, description tier markup `<strong>At Will:</strong> <em>Control Weather</em>` (or `1/Day Each:` per GM intent). Arms `.mc-dice-link-spell` chip via SpellCastLinks → onSpellCast cast log; usage-gated via extractSpellcastingSpellUses — Control Weather spend/refusal economy already unit-proven live (`MonsterCardModal.spellcasting.test.jsx:653` — ability_use spend + "already cast Control Weather today (1/Day)" refusal + `monsterSpellUses` key). No row DC needed (spell has no save). Weather effect itself stays §70 advisory "no weather state modeled". Keep canonical description sentence as row prefix if desired.
- **(B) CODE, heavier:** new monster-row automation `{type:"cast_spell", spell:"Control Weather", ability:"Constitution"}` + chip arm in MonsterAction.jsx + handler logging ability_use with spell-origin stamp; rides no existing consumer (cast_spell grep-zero) — new seam, needs te/none, ticket-sized.

## Residuals (accepted)
Zero-target cast = advisory weather effect (§70 class). No rest-rearm of monsterSpellUses (§9).
