# bug-mon-MA-0459 — Cambion Spellcasting: ZERO chips (all 5 spell names plain-text, MA-0421 family; FAIL(b) DATA)

Row: MA-0459 `cambion|actions|3` Spellcasting (2026-09-18, test-campaign, :5173)

## Verdict: FAIL(b) — pure MA-0421 markup-gap, total zero-affordance row
1. MA-0421 family: ALL 5 authored spell names are plain-text (no `<strong>`/`<em>` on Alter Self, Command, Detect Magic, Dominate Person, Plane Shift) → `extractSpellcastingSpellUses`/`extractSpellNamesFromSpellcasting` yield nothing → `SpellCastLinks` returns null → **0 of 5 chips render**. Only tier headers carry `<strong>`; parser skips names ending `:`.
2. MA-0237/0421 save-seam: row authors `spell_save_dc:14` + `spellcasting_ability:"Charisma"` only — NO row-level numeric `save_dc`/`save_type` → `ActionSaveRoll` (MonsterAction.jsx:88 `if (action.save_dc == null) return null`) renders nothing. `spell_save_dc` never reaches `buildAbilitySaveRollContext` (§89/MA-0421 fingerprint re-confirmed statically; live moot — no affordance exists to prompt).
3. Tier gating unreachable: `extractSpellcastingSpellUses` binds 2/Day & 1/Day only to MARKED names (§99 Bog Sage precedent) → `uses={}` → no `monsterSpellUses` producer, no exhaustion/refusal possible. At-Will tier: none authored (correct).

## Static disk truth (public/data/monsters.json cambion actions[3], verbatim)
- `"name": "Spellcasting"`, `"description": "The cambion casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14):\n<strong>2/Day Each:</strong> Alter Self, Command (level 3 version), Detect Magic\n<strong>1/Day Each:</strong> Dominate Person (level 8 version), Plane Shift (self only)"`, `"spell_save_dc": 14`, `"spellcasting_ability": "Charisma"` — no `save_dc`, no `save_type`, no uses dict. Cambion CHA 16 (+3) → DC 14 authentic. No 2024 twin (grep-zero public/data/2024/).

## Live evidence (cs idx 0 Cambion 1 AC19 HP105 saveBonuses wis:1 cha:3; Bandit 1 AC12 resistances[] WIS saveBonus 0, HP staged 999 fill+Enter; Bandit armed via Cambion's OWN initiative-card target-select → armed:"Bandit 1")
- Rendered `.mc-dice-link-spell` chips in `.mc-overlay`: **0**. Whole-card link audit: ability-mod +N chips, Deception +6 / Perception +4 / Stealth +7, Claw `+7`, Fire Ray `+7` (MA-0456/7/8 rows alive — parser demonstrably running on this same card). Spellcasting row html: `<strong>Spellcasting.</strong> <span>…plain-text names…</span>`, `links: []`.
- Authored-vs-rendered diff: authored 5 (Alter Self 2/Day, Command 2/Day, Detect Magic 2/Day, Dominate Person 1/Day, Plane Shift 1/Day) → rendered 0 → **all 5 missing, proven markup-gap** (disk bytes show zero name-level tags).
- Negative probe: mouse-click on the row's spell-name text ("Alter Self, Command…" span, fresh rect) → popup-overlay/sp-modal/dsp-overlay all 0, log count unchanged 4→4. Inert, silent, no refusals, no spends — zero affordance confirmed live, not just statically.
- DC 14 / Command-Wisdom / exhaustion / Alter-Self-self-target probes: IMPOSSIBLE — no chip exists to click. Zero chips = zero adjudication surface.

## Fix (DATA — MA-0421 markup template + cured-comp row-field pair, same pass)
monsters.json cambion actions[3]:
1. Add `save_dc: 14`, `save_type: "Charisma"` (bone-naga/archmage/lich cured comps byte-shape).
2. Wrap spell names: `…(spell save DC 14):\n<strong>2/Day Each:</strong> <em>Alter Self</em>, <em>Command</em> (level 3 version), <em>Detect Magic</em>\n<strong>1/Day Each:</strong> <em>Dominate Person</em> (level 8 version), <em>Plane Shift</em> (self only)` — qualifier parentheticals stay OUTSIDE the tags (inside-tag qualifiers mis-extract the parenthetical as the spell name and kill header→uses binding, MA-0276). Prose/count bytes otherwise unchanged; JSON.parse + full git diff after (§22 prose anchors not monster-unique).
Post-fix re-verify: 5 chips with (2/Day · N left)/(1/Day · N left) counters, Command chip prompts WIS DC 14 vs Bandit +0, 3rd 2/Day cast refused `automation blocked`, monsterSpellUses keys track spends.

## Cleanup
Admin cleared change-data + log via API; verified empty after 15s debounce, quiet tab (card closed pre-clear).

## Injections this session
Multiple `browser_click` tool ARGS silently stripped mid-session (§90 pattern) — empty results, action never fired; re-anchored every action via single-shot `run_code_unsafe` with explicit selectors. No off-site URLs in any echoed wrapper; tab audit: single localhost tab throughout.
