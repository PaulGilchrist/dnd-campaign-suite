# MA-1320 — Pixie "Spellcasting" — FAIL(a) (DC-chip lane DEAD + MA-1230/1241/1261/1289/1294 markup family)

**Date:** 2026-09-26 · **Campaign:** test-campaign (nav-header verified) · Manifest row NOT edited.
**Rig:** EB exact-td native cb.click() Bandit (CR 0.125 row, NOT Captain/Crime Lord/Deceiver) + Pixie (CR 0.25 row, NOT Wonderbringer) → Join Encounter → card via `img.avatar-image[alt="Pixie 1"]` → `.mc-overlay`. Join census post-click: checked = **["Bandit","Pixie"]** only (§152 survives); post-join log = **3** join-noise entries (1 encounter + 2 initiative rolls) — exact MA-1289/1294 fingerprint.

## Verdict: FAIL(a) — no "DC 12 Charisma" chip exists to press (DC lane structurally unreachable, XOR fork) AND zero spell chips (all 6 names unmarked-up)

## Disk row (public/data/monsters.json, pixie actions[1], "Spellcasting")
```json
{
  "name": "Spellcasting",
  "description": "The pixie casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 12):<br><strong>At Will:</strong> Dancing Lights, Druidcraft, Invisibility (self only)<br><strong>1/Day Each:</strong> Detect Thoughts, Fly, Sleep",
  "attack_bonus": 0, "save_dc": 12, "save_type": "Charisma",
  "save_effect": "", "range": "", "reach": "", "recharge": ""
}
```
- `<strong>` wraps ONLY tier headers ("At Will:", "1/Day Each:") — all 6 spell names plain text.
- Numeric pair `save_dc:12` + `save_type:"Charisma"` PRESENT — but on a row named "Spellcasting" it renders NOTHING clickable (fork below).

## Code evidence (read fresh this session)
- `src/components/encounter/MonsterAction.jsx:390` — `isSpellcastingRow = /^spellcasting$/i.test(action.name)` → TRUE.
- `src/components/encounter/MonsterAction.jsx:349-351` — `SpellOrSaveLinks`: FIRST branch `if (isSpellcastingRow) return <SpellCastLinks/>` — EARLY RETURN; the `ActionSaveRoll` branch (:368, the ONLY "DC X <Type>" chip renderer in the row) is **UNREACHABLE** for spellcasting rows (§118/MA-0532; byte-identical basis MA-1230:22, MA-1289:22, MA-1294:22).
- `MonsterCardHelpers.js extractSpellNamesFromSpellcasting:356-368` — harvests names ONLY from `<strong>/<em>` markup; headers end ":" → excluded → Pixie names [] → `SpellCastLinks:82` zero `.mc-dice-link-spell`.
- `attack_bonus:0` → §444/§490 junk clickable "+0" rides the row.

## Live evidence (row-scoped DOM, `.mc-overlay` innerText startsWith "Pixie")
1. **Row HTML fingerprint:** `<div class="mc-action"><strong>Spellcasting.</strong> <span class="mc-dice-link" role="button" tabindex="0"><i class="fa-solid fa-dice-d20"></i> +0</span><span>The pixie casts …(spell save DC 12):<br><strong>At Will:</strong> Dancing Lights, Druidcraft, Invisibility (self only)<br><strong>1/Day Each:</strong> Detect Thoughts, Fly, Sleep</span><em> ()</em></div>` — cosmetic ` ()` tail (§490 twin).
2. **Chip census:** `.mc-dice-link-spell` OVERLAY-WIDE = **0** (authored list Dancing Lights / Druidcraft / Invisibility / Detect Thoughts / Fly / Sleep → **6/6 missing**, MA-1230/1289/1294 family). Row save chips `.mc-dice-link-save-clickable` = **0**. Row clickables = `[{"t":"+0","cls":"mc-dice-link"}]` junk — **UNPRESSED**.
3. **"DC 12" audit WHOLE overlay:** every `[role=button]/.mc-dice-link` matching /DC 12/i → **0**. "(spell save DC 12)" + Charisma pair surfaces only as plain prose = zero affordance. **Chip-press target does not exist** → step-2 press fork NOT taken.
4. **Zero-affordance probe (synthesized pointer at text-node range):** click prose "Sleep" → log delta **0** (3→3), `.sp-modal` absent, overlays stayed **1**, no save prompt armed. Console errors **0**. Headers end ":" → no §161 fake-chip decoys.
5. Cast legs (At-Will trio, Invisibility self-only clause, 1/Day-Each trio `monsterSpellUses` gate §57) **UNTESTABLE-INERT** — zero chips, zero spends.

## spells.json census (§158 — MA-1241 canonical-name trap INACTIVE here)
| Prose name | 5e spells.json | 2024 spells.json |
|---|---|---|
| Dancing Lights | present, L0 | present, L0 |
| Druidcraft | present, L0 | present, L0 |
| Invisibility | present, L2 | present, L2 |
| Detect Thoughts | present, L2 | present, L2 |
| Fly | present, L3 | present, L3 |
| Sleep | present, L1 | present, L1 |

All 6 names byte-match BOTH indexes — post-markup chips resolve clean under either ruleset (unlike MA-1294's "Tasha's…" 5e-index gap).

## Fix
1. **DATA (family, djinni MA-0611 byte-shape):** wrap EACH spell name `<strong>` (headers already trailing-":" = parse-excluded): `<strong>At Will:</strong> <strong>Dancing Lights</strong>, <strong>Druidcraft</strong>, <strong>Invisibility</strong> (self only)<br><strong>1/Day Each:</strong> <strong>Detect Thoughts</strong>, <strong>Fly</strong>, <strong>Sleep</strong>`. Post-fix: At-Will trio ungated; 1/Day-Each trio binds §57 counter. "Invisibility (self only)" — wrap name only, keep "(self only)" outside the mark.
2. **DC-lane note:** row-level DC chip on spellcasting rows architecturally suppressed app-wide by the XOR fork (family contract MA-1230/1289/1294) — the 12/Charisma pair is a caster-channel label per §894 semantics; not a Pixie-specific defect, no CODE change required by these rules-light cantrips.
3. "+0" removal = separate `attack_bonus:0→null` axis (§490).

## Cleanup
Overlay flushed; admin clears LAST via one snippet: log + change-data 200/200; no page listeners added this session (nothing to `page.off`) — verified via API re-GET (pendingSavePrompts never armed — no save lane existed to arm).

## Registry / manifest
- Manifest `docs/monster-actions-manifest.json` untouched (edit forbidden).
- Registry "Pixie" merged: first adjudicated row → verdict **FAIL(a)** (MIXED-capable ledger seed; Faerie Dust MA-adjacent rows unadjudicated).
