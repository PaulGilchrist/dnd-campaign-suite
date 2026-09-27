# BUG MA-1339 — Priest Spellcasting: zero spell chips (FAIL(b)/DATA, MA-0421 markup family)

**Row:** `MA-1339` `priest|actions|3` — Priest, Spellcasting
**Verdict:** FAIL(b)/DATA — one-row data fix (djinni MA-0611 byte-shape template)
**Date:** 2026-09-26 · Campaign: test-campaign (localhost :5173)

## Symptoms (live, machine-verified)
Priest card Spellcasting row renders **zero spell affordances**:
- `.mc-dice-link-spell` count in row = **0**; `<a>` count = 0.
- Row innerHTML (captured live): spell names are **plain text**; only the tier headers carry `<strong>`:
  `<strong>Spellcasting.</strong> <span class="mc-dice-link" ...>+0</span><span>...<strong>At Will:</strong> Light, Thaumaturgy<br><strong>1/Day:</strong> Spirit Guardians</span><em> ()</em>`
- The only clickable control on the row is the junk `+0` chip (`attack_bonus:0` passes the generic chip gate, §490/MA-1232 family) + cosmetic ` ()`.
- 3 real-mouse presses on the Spellcasting row body (over Light/Thaumaturgy/Spirit Guardians text): **zero log delta (log 6→6), zero popup, zero console errors** — MA-1327 Planetar exact twin (same day), MA-1230 Night Hag twin.

## Root cause (static, code-confirmed)
- `extractSpellNamesFromSpellcasting` (src/components/encounter/MonsterCardHelpers.js:356-367) harvests ONLY `<strong|em>`-wrapped names and skips headers ending `":"`. Priest row marks only the tier headers → returns `[]` → `SpellCastLinks` (MonsterAction.jsx:83, rendered for row name `Spellcasting` at :351) renders no chips (§57/§89/§161).
- `extractSpellcastingSpellUses` (:395-410) binds the `1/Day: 1` limit ONLY to marked names → **Spirit Guardians uses invisible and ungated** (§144); no chip ⇒ no spend, no refusal, no `-spent` class — display/uses both dead (FAIL clause (d): not display-only gate, ZERO affordance).
- Row `save_dc: 0`, `save_type: "Wisdom"`; no `spell_save_dc` anywhere on the monster (grep of entry = none). RAW spell save DC = 8 + WIS(+3) + PB(+2) = **13** — no numeric DC on disk; even after markup fix, Spirit Guardians (has WIS save/half, 2024 spells.json dc) would hit the MA-0860 "DC Unknown spend" / unadjudicated-save lane without a numeric row `save_dc` (§89/§167 pair requirement).

## Spell list vs description (clause (a))
Row description spells match manifest verbatim: At Will: Light, Thaumaturgy; 1/Day: Spirit Guardians; Wisdom = casting ability (prose rendered on card). All three spells resolvable in spells DBs (Light/Thaumaturgy cantrips both files; Spirit Guardians 3rd lvl, 2024 dc {WIS, half}, 5e dc null with wisdom-save prose). Text↔manifest ✓ — the defect is purely the affordance layer.

## Recommended fix (one row, byte-shape template)
Wrap all three names and supply the numeric pair:
```
"description": "The priest casts one of the following spells, using Wisdom as the spellcasting ability:<br><strong>At Will:</strong> <strong>Light</strong>, <strong>Thaumaturgy</strong><br><strong>1/Day:</strong> <strong>Spirit Guardians</strong>"
"save_dc": 13
"save_type": "Wisdom"
```
djinni MA-0611 / night-hag MA-1230 (fixed) byte-shape; 1/Day gate then rides `extractSpellcastingSpellUses` → `monsterSpellUses` map (MA-0020, live per MA-0894). §216 stale-pin check: any test pinning priest row chips-undefined must invert same pass.

## Evidence ledger
- cs: `Priest 1` idx priest (AC13 HP38), `Bandit 1` idx bandit AC12 currentHp 999 (full cs POST via HP trusted-fill; max stays authored 11 §700), armed `tn:Bandit 1` via own-card selectOption.
- Log baseline 6 → 6 after presses; popup census 0; console 0 errors.
- Board admin-cleared after test; registry updated.

## Pitfalls found
- Initiative **+NPC autocomplete li "Bandit" click REPLACED the existing `Priest 1` combatant** (name→Bandit, AC/HP Bandit, monsterIndex stale `priest`) instead of adding — §20 wrong-join family now confirmed at the +NPC seam. Fix used: `.npc-remove-btn` ×2 (confirm-override) + re-join both via EB exact td-text checkboxes. EB join mid-initiative is the reliable multi-monster route.
