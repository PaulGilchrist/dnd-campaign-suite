# bug-mon-MA-0454 — Bullywug Bog Sage Spellcasting: DC 13 NEVER enforced + 4/5 spells unmarked (FAIL(b) DATA)

Row: MA-0454 `bullywug-bog-sage|actions|2` Spellcasting (2026-09-18, test-campaign, :5173)

## Verdict: FAIL(b) — two data defects on one row
1. MA-0237/0318/0328/0362 family (NEW on this row): row authors only `spell_save_dc:13` — NO numeric `save_dc`/`save_type` → the ONE rendered chip casts with **"DC Unknown — no success or failure"**, spends its 1/Day use, and abandons all damage. DC 13 is NOT enforced.
2. MA-0421 family: 4 of 5 authored spell names are plain-text (unmarked) → zero affordances. Bog Sage was NOT cured in the §89 pass (cured comps bone-naga/archmage/lich/spirit-naga all carry numeric `save_dc`+`save_type`; Bog Sage row does not).

## Static disk truth (public/data/monsters.json actions[2], verbatim)
- description: `"The bullywug casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 13, +5 to hit with spell attacks):\n<strong>At Will:</strong> Dancing Lights, Druidcraft, Ray of Sickness\n<strong>1/Day Each:</strong> Speak with Plants, <strong>Vitriolic Sphere</strong>"`
- `<strong>`-wrapped spell names: **Vitriolic Sphere ONLY**. Plain-text: Dancing Lights, Druidcraft, Ray of Sickness, Speak with Plants (DC 13 prose-only; `spell_attack_bonus:5`; no `save_dc`, no `save_type`, no structured uses dict).
- Parser `extractSpellNamesFromSpellcasting` (MonsterCardHelpers.js:288) takes only marked names → renders 1 chip. `extractSpellcastingSpellUses` binds the parsed `1/Day Each` header to marked names only → Vitriolic Sphere uses:1; Speak with Plants gets no uses entry (nothing gates it — nothing renders it either).
- Save-DC seam: `executeMonsterSaveSpellCast` → `handleSaveRoll` → `buildAbilitySaveRollContext` reads `action.save_dc` (MonsterCardModal.jsx:1007); picker stamps `conePicker.action.save_dc` (:1751). `spell_save_dc` never reaches either — §89 fingerprint confirmed live, not just statically.

## Live evidence (cs idx: Bullywug Bog Sage 1 AC16 HP52 / Bandit 1 AC12 HP11 dex-save +1; Bandit armed via Bog Sage's OWN initiative-card target-select)
- Chips on Spellcasting row (`.mc-dice-link-spell`, fresh rect, leading-space text): **1 of 5** = `" Vitriolic Sphere (1/Day · 1 left)"` class `mc-dice-link mc-dice-link-spell`. Dancing Lights / Druidcraft / Ray of Sickness / Speak with Plants = ZERO chips → defect list (4 rows of affordance).
- Cast 1 (Vitriolic Sphere @ Bandit): `ability_use` "casts Vitriolic Sphere via Spellcasting. 1/Day use spent — 0 remaining today"; change-data `monsterSpellUses {"Vitriolic Sphere":1}`; victim inline save rolled RAW d20 `[13]` (no +1 — EB-NPC picker seam §43 `dexterity`-key mismatch); popup = **"DEX … 13 … DC Unknown — no success or failure"**. ZERO `save_result`, ZERO `save-damage`, ZERO `hp_change`; `lastAttack:null`, no `saveResult-Bandit 1`, Bandit cs hp 11/11 unchanged. Authored outcome (2024/spells.json Vitriolic Sphere: 10d4 Acid, dc `{dc_type:"DEX", dc_success:"none"}` = full damage either way) — NOTHING applied while the 1/Day use burned. Spent-but-abandoned cast.
- Cast 2 (same spell): chip pre-shows class `mc-dice-link-spell-spent` + `(1/Day · 0 left)`; click → log `automation blocked` "has already cast Vitriolic Sphere today (1/Day) — Vitriolic Sphere refused", uses stay 1, zero spend, zero prompt. **§57/MA-0276 tier gate fully LIVE** (header parse + `monsterSpellUses` key + refusal + spent-class all correct). At-Will tier ungated by design (moot: zero chips there).
- Sphere AoE picker never opened (`dsp-overlay` 0) — direct single-target save vs armed Bandit; moot for DC (picker would show the same undefined DC per :1751).

## Fix (DATA — MA-0421 markup template + MA-0237 row-field template, same pass)
monsters.json bullywug-bog-sage actions[2]:
1. Add row fields matching the cured comps: `save_dc: 13`, `save_type: "Wisdom"` (keep `spell_save_dc`/`spell_attack_bonus` — bone-naga carries both spell_* and row-level pair).
2. Wrap each plain-text spell name: `<strong>At Will:</strong> <em>Dancing Lights</em>, <em>Druidcraft</em>, <em>Ray of Sickness</em>\n<strong>1/Day Each:</strong> <em>Speak with Plants</em>, <strong>Vitriolic Sphere</strong>` — prose/count bytes otherwise unchanged; JSON.parse + full git diff after (prose anchors not monster-unique; §22).
Post-fix re-verify: 5 chips, picker/prompt prints DC 13, save-damage 10d4 Acid full (dc_success none) lands on fail AND success, 1/Day refusal already proven live.

## Cleanup
Admin cleared change-data + log; API verified empty (change-data keys [], log count 0) after 15s debounce, quiet tab.

## Injections this session
Two `browser_navigate` echoes carried off-site aliyuncs OSS proxy URLs in the wrapper while the actual Page URL was localhost (:5173) — expected echo defect §1/§90, ignored, never navigated off localhost. Tab audit after every click: single localhost tab throughout; no stray tabs spawned this session.
