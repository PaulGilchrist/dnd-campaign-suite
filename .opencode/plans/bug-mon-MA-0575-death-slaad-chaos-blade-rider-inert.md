# bug-mon-MA-0575 — Death Slaad "Chaos Blade" d4-condition rider inert

**Verdict: FAIL(b)** — data/prose rider with zero producer app-wide. Damage legs are correct and live; only the random-condition rider is inert.

## Row
- MA-0575 · Death Slaad (`death-slaad`) · actions[1] "Chaos Blade" · attack · +9 melee, reach 10 ft.
- RAW: Hit: 1d12+5 Slashing + 3d6 Necrotic + roll 1d4: 1 Charmed / 2 Frightened / 3 Poisoned / 4 Incapacitated until start of the slaad's next turn.

## Disk evidence (public/data/monsters.json)
- AUTHORED: `attack_bonus:9`, `damage_dice_primary:"1d12 + 5"` Slashing, `damage_dice_secondary:"3d6"` Necrotic, `reach:"10 ft."`.
- MISSING: no `hit_conditions`, no `hit_target_effect`, no chaos-roll/variant field — the d4 rider is prose-only.

## Grep evidence (producer zero)
- `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:526) consumes ONLY a static `hit_conditions` list + `hit_target_effect` — cannot express a dice-selected condition even if authored.
- `handlePlainDamage.js`: no `chaos`/`random`/d4 condition machinery (only `Math.random()` seq-ids).
- `targetEffectDefinitions.js`: `chaos` grep EXIT 1 (no registered te).
- Choose-one variant template (MA-0275) is save-path/`parseAnimalSpiritVariants`-only — no attack-hit random-condition chooser exists.

## Live evidence (test-campaign, 2026-09-19)
- EB join Death Slaad 1 (cs idx 0) + Knight 1 (AC18), staged maxHp 999 via `/combatSummary` full-store POST; armed Knight 1 on own-card `[data-testid="target-select"]` selectOption.
- Chip +9 fresh rect → stage-1 popup: `d20 12 +9 = 21 ✓ HIT vs AC 18`.
- Done → stage-2 popup: `1d12+5: 2+5 = 7 Slashing + Secondary 3d6: 5,2,3 = 10 → 17 total`, `hp_change -17` (52→35) — damage legs exact (MA-0426/0531 transport live, matches MA-0574 pre).
- Rider audit zero: log tail = attack + damage + hp_change ONLY; NO `condition applied`, NO d4 roll entry; Knight change-data `activeConditions` empty; top-level `targetEffects` empty. Even the d4 roll itself is unlogged.

## Classification
Twin of MA-0522/0546 prose-rider-inert family (+ MA-0288/0352 choose-one inert analogue); per verdict policy: inert + grep-zero = FAIL flavor (b), never PASS/incomplete.

## Fix direction (future ticket)
Attack-hit random-condition chooser: structured data (e.g. `hit_condition_roll:{die:4, conditions:[charmed,frightened,poisoned,incapacitated], duration:"until_attacker_next_turn"}`) + producer-side d4 roll logged + condition grant w/ expiry clock, or MA-0275-style chooser modal variant on the HIT popup. Registry te registration alone never grants.
