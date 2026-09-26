# MA-1323 — Pixie Wonderbringer "Spellcasting" — FAIL(a) (MA-1320 exact twin: DC-chip lane DEAD + zero spell chips)

**Date:** 2026-09-26 · **Campaign:** test-campaign (nav-header verified) · Manifest row NOT edited.
**Rig:** EB exact-td native cb.click() Pixie Wonderbringer (solo checked = ["Pixie Wonderbringer"], §152 survives) → Join Encounter → card via `img.avatar-image[alt="Pixie Wonderbringer 1"]` suffixed alt → `.mc-overlay`. Post-join log baseline = 8 (join + initiative entries).

## Verdict: FAIL(a) — no "DC 15 Charisma" chip exists to press (XOR spellcasting fork, ActionSaveRoll unreachable) AND zero spell chips (all 6 names unmarked-up) + "+0" junk

## Disk row (public/data/monsters.json:48307 block, actions "Spellcasting")
```json
{
  "name": "Spellcasting",
  "description": "The pixie casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15):<br><strong>At Will:</strong> Dancing Lights, Druidcraft, Invisibility (self only)<br><strong>1/Day Each:</strong> Detect Thoughts, Fly, Major Image",
  "attack_bonus": 0, "save_dc": 15, "save_type": "Charisma",
  "save_effect": "", "range": "", "reach": "", "recharge": ""
}
```
- Byte-shape IDENTICAL to MA-1320 Pixie row (`.opencode/plans/bug-mon-MA-1320-spellcasting.md:8-18`) except DC 12→15 and Sleep→Major Image.
- `<strong>` wraps ONLY tier headers — all 6 spell names plain prose; `save_dc:15` + `save_type:"Charisma"` present but renders NOTHING clickable on a row named "Spellcasting".

## Code basis (MA-1320 plan §"Code evidence" — cited, re-read unchanged family)
- `src/components/encounter/MonsterAction.jsx:350-351` (per MA-1320:390/349-351) — `isSpellcastingRow` → EARLY RETURN `<SpellCastLinks/>`; `ActionSaveRoll` "DC X <Type>" chip branch UNREACHABLE (§118/MA-0532; family MA-1230/1289/1294).
- `MonsterCardHelpers.js extractSpellNamesFromSpellcasting:356-368` — harvests names only from `<strong>/<em>`; headers end ":" excluded → names [] → zero `.mc-dice-link-spell`.
- `attack_bonus:0` → §444/§490 junk clickable "+0".

## Live evidence (row-scoped DOM, `.mc-overlay` innerText startsWith "Pixie Wonderbringer")
1. **Row HTML fingerprint (byte-twin of MA-1320:27):** `<div class="mc-action"><strong>Spellcasting.</strong> <span class="mc-dice-link" role="button" tabindex="0"><i class="fa-solid fa-dice-d20"></i> +0</span><span>The pixie casts …(spell save DC 15):<br><strong>At Will:</strong> …<br><strong>1/Day Each:</strong> Detect Thoughts, Fly, Major Image</span><em> ()</em></div>` — cosmetic ` ()` tail (§490 twin).
2. **Chip census:** `.mc-dice-link-spell` ROW = **0**, OVERLAY-WIDE = **0** (Dancing Lights / Druidcraft / Invisibility / Detect Thoughts / Fly / Major Image → **6/6 missing**). Row `.mc-dice-link-save-clickable` = **0**. Row clickables = `[{"t":"+0","cls":"mc-dice-link"}]` junk — **UNPRESSED**.
3. **"DC 15" audit WHOLE overlay:** every `[role=button]/.mc-dice-link` matching /DC 15/i → **0**. "(spell save DC 15)" + Charisma pair = plain prose, zero affordance → chip-press fork NOT taken.
4. **Zero-affordance probe (synthesized pointer at text-node range of "Major Image"):** log delta **0** (8→8), `.sp-modal` absent, overlays stayed **1**, pendingSavePrompts **null** (never armed), app console errors **0**.
5. Cast legs (At-Will trio, Invisibility self-only clause, 1/Day-Each trio `monsterSpellUses` gate §57) **UNTESTABLE-INERT** — zero chips, zero spends.

## spells.json census (§158 — MA-1241 canonical-name trap INACTIVE here)
| Prose name | 5e spells.json | 2024 spells.json |
|---|---|---|
| Dancing Lights | present, L0 | present, L0 |
| Druidcraft | present, L0 | present, L0 |
| Invisibility | present, L2 | present, L2 |
| Detect Thoughts | present, L2 | present, L2 |
| Fly | present, L3 | present, L3 |
| Major Image | present, L3 | present, L3 |

All 6 names byte-match BOTH indexes — post-markup chips resolve clean under either ruleset.

## Fix (DATA, MA-1320 family recipe / djinni MA-0611 byte-shape)
1. Wrap EACH spell name `<strong>` (headers already trailing-":" = parse-excluded):
   `<strong>At Will:</strong> <strong>Dancing Lights</strong>, <strong>Druidcraft</strong>, <strong>Invisibility</strong> (self only)<br><strong>1/Day Each:</strong> <strong>Detect Thoughts</strong>, <strong>Fly</strong>, <strong>Major Image</strong>`
   Post-fix: At-Will trio ungated; 1/Day-Each trio binds §57 counter. Keep "(self only)" OUTSIDE the mark.
2. DC-lane note: row-level DC chip on Spellcasting rows architecturally suppressed app-wide by XOR fork (MA-1230/1289/1294/1320 contract) — DC 15/Charisma is caster-channel label per §894; no CODE change required.
3. "+0" removal = separate `attack_bonus:0→null` axis (§490).

## Cleanup
Admin clears one snippet: `POST /admin/clear-change-data` + `POST /admin/clear-log` → **200/200**; verified log GET len **0**, cs GET `value:null`. Overlay flushed via `.remove()`; no persistent page listeners added (dispatched listeners died with overlay). One transient console error = exploratory wrong-endpoint `DELETE /log` 404 (correct route is `POST /admin/clear-log`), not an app defect.

## Registry / manifest
- Manifest `docs/monster-actions-manifest.json` untouched (edit forbidden).
- Registry "Pixie Wonderbringer": first adjudicated row → verdict **FAIL(a)** (MIXED-capable ledger seed; Faerie Dust / other Wonderbringer rows unadjudicated — merge MIXED pending siblings).
- Twin ledger: Pixie MA-1320 FAIL(a) (2026-09-26) — same XOR-fork + unmarked-up-names signature; DC 12 vs 15 and Sleep vs Major Image are the only disk deltas.
