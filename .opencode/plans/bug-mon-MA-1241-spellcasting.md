# MA-1241 — Noble Prodigy "Spellcasting" — FAIL(a) / DATA (MA-0421/0524/MA-1230 markup family)

**Date:** 2026-09-25 · **Campaign:** test-campaign (header-verified) · **Rig:** EB join Noble Prodigy 1 (HP148, cs idx1, init 9) + Bandit 1 (AC12, HP999 inline-stamped, init 19). Card via `img.avatar-image[alt="Noble Prodigy 1"]`.

## Verdict: FAIL(a)/DATA — zero spell chips (spell names unmarked-up) → whole row affordance-dead; same MA-1230 fingerprint

## Disk row (public/data/monsters.json, noble-prodigy actions[2], "Spellcasting")
```json
{
  "name": "Spellcasting",
  "description": "The noble casts one of the following spells, ... (spell save DC 16):<br><strong>At Will:</strong> Mage Armor (included in AC), Mage Hand, Minor Illusion<br><strong>1/Day Each:</strong> Befuddle ment, Detect Thoughts, Fly, Scrying, Shatter (level 7 version)",
  "attack_bonus": 0, "save_dc": 16, "save_type": "Charisma",
  "save_effect": "…Befuddle (Intelligence DC check…), Detect Thoughts (Wisdom save…), Shatter (Constitution save…)", "range": "", "recharge": ""
}
```
- `<strong>` wraps ONLY the tier headers ("At Will:", "1/Day Each:") — **all 8 spell names are plain text**.
- Numeric `save_dc:16` + `save_type:"Charisma"` pair IS present (§89 numeric gate satisfied) — sole chip defect axis is spell-name markup (MA-1230 new pitfall re-confirmed: numeric pair ≠ chips).
- **OCR typo:** description says "Befuddle ment" — canonical spell is **"Befuddlement"** (2024-only, `public/data/2024/spells.json` index `befuddlement`, L8 Enchantment, INT save). "Befuddle" itself is ABSENT in BOTH spells.json → the pre-diagnosis fix target "Befuddle" would mint a second unresolvable name; correct fix is "Befuddle ment" → **"Befuddlement"**.

## Code evidence (grep, line numbers verified today)
- `src/components/encounter/MonsterCardHelpers.js:356-367` — `extractSpellNamesFromSpellcasting`: regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`, skips names ending `":"` (:363). Only the two headers match → **returns []**.
- `src/components/encounter/MonsterAction.jsx:83-84` — `SpellCastLinks`: `if (names.length === 0) return null` → zero `.mc-dice-link-spell` chips.
- `src/components/encounter/MonsterAction.jsx:404-411` — `attack_bonus:0` row admits the bogus clickable "+0" chip (§490/§444 family) — **unpressed**.

## Live evidence
1. **Chip census (row-scoped DOM):** `.mc-dice-link-spell` count = **0** (authored list = Mage Armor, Mage Hand, Minor Illusion, Befuddlement[typo], Detect Thoughts, Fly, Scrying, Shatter → 8/8 missing = §421/§524/MA-1230 FAIL family). Sole in-row link: `{"text":"+0","cls":"mc-dice-link","role":"button"}` (junk, unpressed). Row HTML: headers `<strong>…:</strong>`, names bare inside plain `<span>`; trailing cosmetic `<em> ()</em>`.
2. **Whole-overlay controls audit:** `[role=switch]`=0, `[role=radiogroup]`=0, `[role=tablist]`=0 — expected zero.
3. **Control probe (§190):** real-pointer click on prose "Mage Armor (included in AC)" → log delta **0** (baseline 3 join-noise entries: encounter + 2× Initiative, before AND after), popups **0**, console errors **0**, no junk `ability_use` (§161 clean — headers end ":" so even fake-chip decoys absent).
4. Cast legs (DC 16 surface, 1/Day gates ×5 per §57, Shatter lvl-7 ledger, Scrying/Detect Thoughts utility advisories) **UNTESTABLE-INERT** — no chips to press; zero spends occurred.

## spells.json existence census
| Spell | 5e `/data/spells.json` | 2024 `/data/2024/spells.json` | Notes |
|---|---|---|---|
| Mage Armor | PRESENT (L1) | PRESENT (L1) | "included in AC" — At-Will utility, cast would be advisory §57/§69 |
| Mage Hand | PRESENT (L0) | PRESENT (L0) | utility |
| Minor Illusion | PRESENT (L0) | PRESENT (L0) | utility |
| **Befuddle ment** | ABSENT | ABSENT | **typo-drift** |
| Befuddle | ABSENT | ABSENT | pre-diagnosis guess WRONG |
| **Befuddlement** | ABSENT | **PRESENT** (index `befuddlement`, L8 Enchantment, INT save, 10d12 Psychic) | canonical target; casts via live findMonsterSpell 5e→2024 fallback (MA-0680/§207) |
| Detect Thoughts | PRESENT (L2) | PRESENT (L2) | |
| Fly | PRESENT (L3) | PRESENT (L3) | |
| Scrying | PRESENT (L5) | PRESENT (L5) | |
| Shatter | PRESENT (L2) | PRESENT (L2) | "(level 7 version)" = slot-upcast note |

## Fix (DATA, one-axis + typo, djinni MA-0611 byte-shape)
Wrap EACH spell name in `<strong>` in the description (tier headers already trailing-":" marked = correctly excluded chips §161) AND repair "Befuddle ment" → "Befuddlement":
`... <strong>At Will:</strong> <strong>Mage Armor</strong> (included in AC), <strong>Mage Hand</strong>, <strong>Minor Illusion</strong><br><strong>1/Day Each:</strong> <strong>Befuddlement</strong>, <strong>Detect Thoughts</strong>, <strong>Fly</strong>, <strong>Scrying</strong>, <strong>Shatter</strong> (level 7 version)`
Row already carries `save_dc:16`+`save_type:"Charisma"` pair (§167 requirement pre-met). Post-fix: 1/Day chip counter + `monsterSpellUses` gate binds the five 1/Day spells (§57); At-Will trio ungated by design; "+0" junk removal = separate `attack_bonus:0→null` axis (§490/MA-1232 recipe) — leave unless fix-owner batches it. Befuddlement is 2024-only L8 vs CR-10 caster: honest-residual advisory expected on cast (findMonsterSpell 2024-fallback resolves; no console "Spell not found" §207).

## Registry / manifest
- Manifest untouched (edit forbidden). Registry Noble Prodigy entry merged with MA-1241 FAIL ledger; MA-1239/MA-1240 ledgers preserved.
- Cleanup: Admin Clear Campaign Log (log 0) + Clear Change Data (cs `{}`) on test-campaign, confirmed.
