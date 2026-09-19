# bug-mon-MA-0452 — Bullywug Bog Sage Multiattack: "replace with Ray of Sickness" INERT (FAIL(b) DATA)

Row: MA-0452 `bullywug-bog-sage|actions|0` Multiattack (2026-09-18, test-campaign, :5173)

## Verdict: FAIL(b) — data markup gap (MA-0421 family)
Header + Bog Staff components verified live/exact; the replace-with-spell clause has ZERO affordance and zero code consumers → inert.

## Expected (row text, byte-matched monsters.json actions[0])
"makes two Bog Staff attacks. It can replace any attack with a use of Spellcasting to cast Ray of Sickness."

## Actual (live)
- Card Spellcasting row renders exactly ONE `.mc-dice-link-spell` chip: "Vitriolic Sphere (1/Day · 1 left)". Ray of Sickness / Dancing Lights / Druidcraft = plain text → no chips (4 chip clicks total, zero spell/Ray log entries).
- Clause itself: grep app-wide `replace any attack|replace.*spellcast` → zero consumers; replacement rides Spellcasting-row chips (MA-0223 fingerprint).
- Parser `extractSpellNamesFromSpellcasting` (MonsterCardHelpers.js:288, consumed by SpellCastLinks MonsterAction.jsx:61) captures ONLY `<strong>/<em>`-wrapped names — this row wraps only "Vitriolic Sphere". MA-0421 fingerprint confirmed live.

## Bog Staff components PROVEN exact (same turn, no turn-advance, Bandit AC12 cs-armed via own-card select, cs idx0 bullywug-bog-sage AC16 HP52)
- Click1: nat8+5=13 vs AC12 HIT; dmg [7]+3=10 primary==finalDamage, sec [5,3,2]=3d6=10; hpΔ−20 (11→0 clamp).
- Click2 (revived): nat13+5=18 HIT; dmg 6+3=9==finalDamage, sec [2,5,5]=12; hpΔ−21 (clamp 0).
- Click3 (HP60): nat20 CRIT; dice-only doubled "1d8×2+3"=19==finalDamage, sec 6d6=26==secondaryFinalDamage; hpΔ−45 (60→15). Flat +3 not doubled.
- Click4: nat6+5=11 vs 12 ✗ MISS — hit:false, zero damage roll, zero hp_change, chip remains live (no lock).
- Chain: Σ|hpΔ| 86 == Σ(final+secondary) 86 exact across 3 hit damages. Count "two attacks" GM-adjudicated per MA-0009/0223 (extra fires allowed by design).

## Ray of Sickness authored truth (for fixer)
- Only in public/data/2024/spells.json: `attack_type:"ranged"`, 2d8 Poison + Poisoned condition on hit, **no saving throw** (orchestrator prompt's "Con save prompt" expectation contradicts authored data).
- Row spells fields: Spellcasting `spell_save_dc:13`, `spell_attack_bonus:+5`, Wisdom.

## Fix (DATA, archmage/lich MA-0421 byte-shape precedent)
monsters.json bullywug-bog-sage actions[2] description — wrap At-Will spell names individually:
`<strong>At Will:</strong> <em>Dancing Lights</em>, <em>Druidcraft</em>, <em>Ray of Sickness</em>` (and wrap `Speak with Plants` similarly). Prose/count bytes otherwise unchanged; JSON.parse + git diff after (prose anchors not monster-unique).

## Cleanup
Admin cleared change-data + log; API empty x2 quiet checks.

## Injections this session
navigate echoed off-site OSS proxy URL (real URL localhost:5173); stray off-site tab github.io/dnd-tools opened by click — closed, never visited; several tool-arg echoes mangled — re-anchored via fresh refs throughout.
