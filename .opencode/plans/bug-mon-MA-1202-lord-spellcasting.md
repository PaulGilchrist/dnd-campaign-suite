# Bug: MA-1202 Mummy Lord Spellcasting — plain-text spell names render ZERO affordances (MA-0421 family)

## Overview
MA-1202 (mummy-lord actions[4] "Spellcasting") is a zero-affordance row. The disk description wraps only the tier headers (`<strong>At Will:</strong>`, `<strong>1/Day Each:</strong>`) in markup; all five spell names are **plain text**, so the chip extractor yields nothing and no spell can be cast at all. No cast, no DC enforcement, no 1/Day gate, no Insect Plague level-7 variant — every listed spell leg is inert. Row-level `save_dc:17` + `save_type:"Wisdom"` ARE authored (DC 17 correct on disk) but never reach the save lane: rows named "Spellcasting" render `SpellCastLinks` XOR `ActionSaveRoll` (MonsterAction.jsx:305/322, §532), so even the generic DC chip never appears.

## Expected
Per MA-0421/MA-0611/MA-0619/MA-0576/MA-1119 fix template (byte-twin live in-file: ghast-gravecaller MA-0777), each spell name wrapped in `<strong>` yields per-spell chips `span.mc-dice-link-spell`, tier-header parsing binds `extractSpellcastingSpellUses` → `{Animate Dead:1, Harm:1, Insect Plague:1}`, At Will stays ungated, and 1/Day casts gate via the live `monsterSpellUses` consumer (`spendMonsterSpellUseIfNeeded`, MonsterCardModal.jsx:1288/:2135) with `automation blocked`/refusal + "(N left)" counter on the second cast.

## Actual
- Live card audit (Mummy Lord 1, EB-joined, board test-campaign): Spellcasting row contains `mc-dice-link-spell` count **0**, `mc-dice-link-save-clickable` count **0**, `button` count 0. Only interactive element is a stray `+0` junk chip from `attack_bonus:0` (§444 — not pressed).
- Machine proof in live app context: `extractSpellNamesFromSpellcasting(row.description)` → `[]`; `extractSpellcastingSpellUses(row.description)` → `{}`.
- Pressing the bold tier headers twice → zero log delta (log stayed at join-noise 2: encounter + initiative roll), zero popup, `monsterSpellUses` key ABSENT, `Mummy Lord 1` change-data store key entirely absent (§1116 strongest zero-grant proof). Console 0 errors.
- No per-spell adjudication leg reachable: Dispel Magic / Thaumaturgy / Harm (CON half, 14d6)/ Insect Plague (level-7 `damage_at_slot_level["7"]="6d10"`, CON half, 20-ft sphere)/ Animate Dead — **all five zero affordance**. 1/Day gate untestable by construction (no cast = no spend = gate never engaged).

## Steps to reproduce
1. test-campaign → Encounters → search "Mummy Lord" → check exact td[1]==='Mummy Lord' (CR15/13,000/Desert) → Join Encounter.
2. Open card (native `img.avatar-image[alt="Mummy Lord 1"]`.click()), scroll to Spellcasting row.
3. Observe: bold tier headers + plain-text spell names, no `mc-dice-link-spell` chips, no DC 17 chip. Click text — nothing happens.

## Disk data (truth)
`public/data/monsters.json` mummy-lord actions[4]:
- `save_dc:17`, `save_type:"Wisdom"`, `attack_bonus:0` — DC 17 + Wisdom **authored correctly, row↔manifest numbers match** (manifest saveDc 17/saveType Wisdom ✓; "spell save DC 17, +9 to hit" prose byte-present; `spellCastLevelFromSpellcasting` would parse "(level 7 version)" → 7 → spells.json `6d10` **if castable**).
- description tail: `At Will: Dispel Magic, Thaumaturgy` / `1/Day Each: Animate Dead, Harm, Insect Plague (level 7 version)` — names UNMARKED.
- spells.json (5e): all five spells present, no list drift — Dispel Magic L3 utility (no attack_type/dc; targeted dispel, §MA-0245 misroute N/A), Thaumaturgy cantrip utility, Animate Dead L3 summon (no dc), Harm L6 CON/half `14d6` Necrotic, Insect Plague L5 CON/half sphere-20 with `damage_at_slot_level {"7":"6d10"}`. Row `save_type:"Wisdom"` = casting ability, not target save type (§894 — not a defect axis).
- Trailing `()` range artifact on the rendered row (§477 family) — cosmetic.

## Likely Location
- **DATA (primary, one-fix-class):** `public/data/monsters.json` mummy-lord Spellcasting description — wrap each spell name `<strong>Name</strong>` (ghast-gravecaller/archmage MA-0421 byte-shape; row already carries the required numeric `save_dc`+`save_type` pair, §167, so no second fix needed).
- Renderer/parser is live-unarmed (NOT code gap): `MonsterCardHelpers.js:356 extractSpellNamesFromSpellcasting` / `:395 extractSpellcastingSpellUses`, `MonsterAction.jsx:81 SpellCastLinks` (`names.length===0 → null`), gate consumers `MonsterCardModal.jsx:1288 spendMonsterSpellUseIfNeeded` + `:1728 monsterSpellUses` runtime channel exist and are proven-live twins (MA-0894/MA-1119).

## Per-spell adjudication
| Spell | Tier | Affordance | Leg result |
|---|---|---|---|
| Dispel Magic | At Will | ZERO chip | inert — FAIL(b) leg |
| Thaumaturgy | At Will | ZERO chip | inert — FAIL(b) leg |
| Harm | 1/Day | ZERO chip | no cast, gate untestable — FAIL(b) leg |
| Insect Plague (L7) | 1/Day | ZERO chip | variant unreachable — FAIL(b) leg |
| Animate Dead | 1/Day | ZERO chip | no summon affordance — FAIL(b) leg |

All five spells are on the core listed plan → row FAIL per trichotomy (zero-affordance listed spells, consumer grep-live-unarmed precedent MA-0524/MA-0532/§144).

## Notes / residuals
- 1/Day re-arm GM-side has no rest consumer (§70) — moot while gate is unreachable; will inherit that residual post-fix.
- Manifest-vs-disk: no numeric drift found; mismatch axis is markup-only (MA-0421 exact family).
- Board at session end: admin-cleared quiet 15s — log=[], cd={}, cs=null (verified).
