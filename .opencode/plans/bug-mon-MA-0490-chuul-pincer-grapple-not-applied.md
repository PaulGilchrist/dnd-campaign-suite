# bug-mon-MA-0490 — Chuul Pincer: grapple-on-hit never applied (DATA, prose-only)

**Verdict: FAIL(b) — DATA twin (MA-0291/0361/0434 family; predicted by MA-0489 twin-row advisory)**
Date: 2026-09-18 · Campaign: test-campaign · localhost:5173

## Row
MA-0490 · Chuul (`index: chuul`) · actions[1] · Pincer · attack +6 · reach 10 ft · 1d10+4 Bludgeoning · brief conditions: [grappled]

## Disk shape (public/data/monsters.json, chuul.actions[1])
Keys present: `attack_bonus, damage_dice_primary, damage_type_primary, description, name, reach, save_effect`
**Missing: `hit_conditions`, `hit_target_effect`, `escape_dc`.** Grapple clause exists only as prose in `save_effect`/`description`.

## Live evidence (vs Bandit 1, AC12, resistances[] clean, HP staged 999 via card input)
Target armed on Chuul's own initiative card `[data-testid="target-select"]` (card idx 0).

| # | d20 | +6 | vs AC12 | log hit | damage roll | total | finalDamage | hp_change |
|---|-----|----|---------|---------|-------------|-------|-------------|-----------|
| 1 | 1 (crit miss) | 7 | MISS | false | — | — | — | none |
| 2 | 5 | 11 | MISS | false | — | — | — | none |
| 3 | 13 | 19 | HIT | true | [1] | 5 | 5 Bludgeoning | −5 (999→994) |
| 4 | 17 | 23 | HIT | true | [5] | 9 | 9 Bludgeoning | −9 (994→985) |

- Attack chip "+6" live; `total==finalDamage==|hpΔ|`; formula `1d10 + 4` byte-exact; misses pay zero. Attack/damage legs PASS.
- **Defect:** after 2 hits on a Medium (Large-or-smaller) victim — ZERO `condition applied` log entries, Bandit 1 change-data `{}` (no activeConditions), top-level `targetEffects` ABSENT. Grapple clause fully inert, unenforced trigger = FAIL(b) per playbook verdict policy; consumer seam exists but reads `action.hit_conditions` only (`buildHitConditionClause`, handlePlainDamage.js).

## Fix (data)
Add to `chuul.actions[1]`: `"hit_conditions": ["grappled"]`, `"escape_dc": 14`. Large-or-smaller gate already honored by consumer (MA-0291/0361 precedent). Prose in `save_effect` may stay for display; consumer ignores it.

## Cleanup
Admin clear-change-data + clear-log both 200; verified empty after +15 s, no resurrection. Registry: Chuul entry merge-appended MA-0490 block alongside MA-0489, JSON.parse disk-checked.

## New pitfalls this run
- Initiative-avatar `img.avatar-image` has NO `[data-testid="target-select"]` ancestor even on real joined monster cards (§124 extends past `.mc-overlay` to the initiative list itself) — locate attacker select by card nth-ordinal (self-excluded options identify it).
- MA-0489 registry text mentioning "MA-0490" (twin advisory) breaks naive dup-guard on merge-append — anchor on `MA-XXXX <RowName> row`.
- Absorbed-first-click NOT observed on MA-0490 Pincer chip (4/4 fired first click) — chip-specific confirmed (§113/§97).
- Miss popup stage prints "click to dismiss" with no Done; `.popup-overlay` el.click() flush handled both stages cleanly, card stayed open.
- 0-damage rolls `[1]`/`[5]` with totals 5/9 on 1d10+4 — single-die display retained, no defect.
