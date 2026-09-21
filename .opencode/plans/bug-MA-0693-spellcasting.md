# Bug MA-0693 — Empyrean Spellcasting: phantom spell name "Pass with Trace"

- **Monster:** Empyrean (empyrean), actions[3] Spellcasting, spell_save_dc 23 (cosmetic)
- **Verdict:** FAIL(b) / DATA — one-field fix
- **Date/campaign:** 2026-09-20, test-campaign, EB-joined "Empyrean 1" cs idx0

## Fingerprint (§158 junk / §23 name-typo family / §524)
Row authors `Pass with Trace`; `findMonsterSpell` (MonsterCardModal.jsx:1030) is exact-match 5e-then-2024 with no fuzzy fallback; BOTH spell DBs carry **"Pass Without Trace"** (grep-zero for "Pass with Trace" app data). Chip renders (markup-driven §89) and clicking produces:
1. `console.error [MonsterCardModal] Spell 'Pass with Trace' not found in spells.json (5e or 2024)` (observed @ MonsterCardModal.jsx:2177 live) — §158 console fingerprint.
2. Junk zero-adjudication advisory `ability_use` "Empyrean 1 casts Pass with Trace via Spellcasting. Spell effect is recorded; GM-enforced for monsters." — phantom spell recorded as cast, no effect, no reference.

## Live ledger (all other rows correct)
- 7 chips exact per markup; At-Will x4 ungated (Calm Emotions x2 clean advisory zero-refused); 1/Day gate LIVE: Commune spend log + chip 1->0 + second-cast `automation blocked` (§57); DEG spent; machine truth monsterSpellUses {Commune:1, "Dispel Evil and Good":1}.
- Plane Shift honest pre-spend spell-ATTACK refusal (5e attack_type melee, no row spell_attack_bonus) — zero burn, MA-0611 twin accepted; not this ticket.
- Cleanup admin clears verified quiet.

## Fix (DATA, one field)
public/data/monsters.json empyrean Spellcasting description:
`<strong>Pass with Trace</strong>` → `<strong>Pass Without Trace</strong>`
Post-fix: chip cast resolves 5e entry (2nd level, concentration, range Self) → clean advisory ability_use, console zero-error. Note §21/§177: post-edit needs reload+campaign re-select (EB combatants carry stale snapshots); §164: no row-level save_dc needed — Spellcasting XOR keeps row chip path inert-by-design (§532), markup byte-equality otherwise.
