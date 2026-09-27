# BUG MA-1342 — Priest Acolyte Spellcasting: zero spell chips (FAIL(b)/DATA, MA-0421/MA-1339 markup family)

**Row:** `MA-1342` `priest-acolyte|actions|2` — Priest Acolyte, Spellcasting
**Verdict:** FAIL(b)/DATA — markup-only row fix (djinni MA-0611 byte-shape template)
**Date:** 2026-09-26 · Campaign: test-campaign (localhost :5173, dev reused 200)

## Symptoms (live, machine-verified on THIS card)
Priest Acolyte card Spellcasting row renders **zero spell affordances**:
- `.mc-dice-link-spell` count in row = **0**; `<a>` count = **0**.
- Live row innerHTML captured:
  `<strong>Spellcasting.</strong> <span class="mc-dice-link" role="button" tabindex="0"><i class="fa-solid fa-dice-d20"></i> +0</span><span>The priest casts one of the following spells, using Wisdom as the spellcasting ability:<br><strong>At Will:</strong> Light, Thaumaturgy</span><em> ()</em>`
  → the ONLY `<strong>`/`<em>` spans are `Spellcasting.` and the tier header `At Will:`; **Light** and **Thaumaturgy are PLAIN TEXT** (identical shape to MA-1327 Planetar / MA-1339 Priest).
- 3 real-mouse presses on the row body (over "Light, Thaumaturgy" / "using Wisdom as the spellcasting ability"): **log 2→2 zero delta, zero popup, zero console errors** (Console: Errors 0).
- `pendingSavePrompts` key **ABSENT** in change-data (DC lane never reached — correct, see below).

## Root cause (static + live control, code-confirmed)
- `extractSpellNamesFromSpellcasting` (`src/components/encounter/MonsterCardHelpers.js:356-367`, regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`, skips `":"` headers) run against the disk description returns **`[]`** (node-proved + live re-run): only marked token is `At Will:` (header, skipped).
- Row is named `Spellcasting` → `SpellOrSaveLinks` routes to **`SpellCastLinks` XOR `ActionSaveRoll`** (`MonsterAction.jsx:390` → `:350`). `SpellCastLinks` (`:83`) returns `null` when `names.length===0` → zero chips (§57/§89/§161). Row-level `save_dc` never reaches this lane (§532) — the save lane is not involved here.
- `extractSpellcastingSpellUses` (`:395-410`) binds limits ONLY to marked names → `{}` (nothing to bind; no 1/Day tier on this row anyway) — uses tracking dead but N/A (At-Will).
- **CONTROL PROBE (live):** identical regex run against the FIXED djinni (`/data/monsters.json`, MA-0611) Spellcasting row returns **10** marked spell names (Detect Evil and Good, Detect Magic, … Plane Shift) → that card renders live `.mc-dice-link-spell` chips. Same parser, marked-markup twin yields chips, plain-text acolyte yields zero ⇒ defect is **purely the acolyte row's missing per-name `<strong>` markup**, not a broken renderer.

## Spell list vs description (clause (a)) — VERBATIM ✓
Row spells match manifest verbatim: "At Will: Light, Thaumaturgy"; casting ability prose "using Wisdom as the spellcasting ability" rendered on card. Wisdom prose ✓ present. Text↔manifest byte-consistent — the defect is entirely the affordance (chip) layer.

## Junk `+0` chip (secondary observation, §490/MA-1232 family)
Disk `attack_bonus: 0` is present → the generic attack-chip gate (`MonsterAction.jsx:408`, `attack_bonus != null`) arms a junk `+0` `mc-dice-link` on a utility Spellcasting row. Pressing it once logged `{type:"roll", name:"Spellcasting", total:14, bonus:0}` — a naked d20 with **no vs AC, no targetName, no damage** (no target armed, §28) + an Advantage/Disadvantage attack popup. This is cosmetic junk, not the core defect, but it should not arm on a save-less spellcasting row; the row should not carry `attack_bonus` at all (or the chip should be suppressed for Spellcasting rows).

## DC status (precise)
- Disk `save_dc: 0`, `save_type: "Wisdom"`. RAW spell save DC = 8 + WIS(+2, wis 14) + PB(+2) = **12**.
- **DC is N/A / moot here**: Light and Thaumaturgy are At-Will utility cantrips with **no saving throw**, and the row routes through SpellCastLinks (never the save lane), so a numeric DC is not required for the fix. `save_dc:0` is harmless. RAW DC 12 documented for completeness only; do not treat as the defect axis.

## Recommended fix (markup-only, byte-shape template)
Wrap each spell name in `<strong>`:
```
"description": "The priest casts one of the following spells, using Wisdom as the spellcasting ability:<br><strong>At Will:</strong> <strong>Light</strong>, <strong>Thaumaturgy</strong>"
```
djinni MA-0611 / spirit-naga MA-0421 byte-shape. SpellCastLinks then extracts `['Light','Thaumaturgy']` → two live `.mc-dice-link-spell` chips → casts route through `onSpellCast`/`handleSpellCast` (utility advisory `ability_use` lane, MA-0680/MA-0777). No `save_dc`/`save_type` pair required here (§230: SpellCastLinks arms on row NAME + tier markup only, save-less twins render chips with zero numeric DC) — the MA-0611 `save_dc`+`save_type` addition was for djinni's save-bearing spells and is NOT needed for these two save-less cantrips. §216 stale-pin check: any test pinning `priest-acolyte` Spellcasting chips-undefined must invert same pass.

## Evidence ledger
- cs: `Priest Acolyte 1` idx0 AC13 HP11 `monsterIndex:priest-acolyte`; `Bandit` idx15 AC12 HP11 joined via +NPC exact-li (no slot-clobber, cs re-verified — §MA-1339 flaky did not recur). Active `AasimarTest`, round 1.
- Live row probe: `.mc-dice-link-spell` 0, `<a>` 0, innerHTML dumped above.
- 3 plain-text row presses → log 2→2, popups 0, Console errors 0, `pendingSavePrompts` KEY_ABSENT.
- Junk `+0` chip press → log `roll` "Spellcasting" total 14 bonus 0, no AC/target/damage.
- Control probe → djinni MA-0611 row extracts 10 names (parser functional).
- Board admin-cleared after test; registry updated.

## Pitfalls found
- None new beyond MA-1339 twin re-confirmation. +NPC autocomplete exact-li "Bandit" click did **not** clobber the EB-joined Priest idx0 this session (§MA-1339 flaky, cs re-verify still mandatory). The junk `+0` chip on a save-less Spellcasting row (from `attack_bonus:0`) rolls a target-less naked d20 — worth noting as a §490 junk-chip instance on the Spellcasting row specifically (row should carry no `attack_bonus`).
