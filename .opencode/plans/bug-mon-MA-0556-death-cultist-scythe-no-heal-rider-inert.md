# MA-0556 Death Cultist — Dread Scythe no-heal rider inert (FAIL-b, DATA)

**Row:** MA-0556 Death Cultist "Dread Scythe" (+7 melee 10 ft., 1d10+4 Slashing + 2d10 Necrotic, target can't regain HP until end of its next turn). test-campaign, 2026-09-19, dev :5173.

## Verdict: FAIL(b) — damage legs LIVE exact; RAW "can't regain Hit Points" rider inert

## LIVE EVIDENCE (Death Cultist 1 idx0 + Knight 1 AC18, both staged 999 via /combatSummary full-store POST)
- 9 chip rolls on `.mc-action:has-text('Dread Scythe') span.mc-dice-link` "+7" (armed own-card target-select→Knight 1): 7 HIT / 2 MISS (nat 19,19,15,19,13,19,16 HIT; nat6 HIT-false ×2 — 2nd was §77 cached-replay, zero damage).
- Every HIT exact via MA-0426/0531 `combined_damage_roll` transport: primary formula "1d10 + 4" + `secondaryFormula:"2d10"`/`secondaryTotal`, `finalDamage` == `|hp_change|` every time (28=9+19, 11=6+5, 16=7+9, 20=8+12, 16=6+10, 28=10+18, 21=12+9).
- MISS zero-damage: attCount 8→9, dmgCount stayed 7, Knight frozen 859, log `hit:false`.
- Crit: zero nat20 in 9 rolls — crit clause unproven live; seam byte-identical §32/MA-0555 (dice-only doubling, flat +4 once, secondary×2); note-only.
- RIDER INERT proof: after 7 landed hits, top-level change-data `targetEffects` key ABSENT, `Knight 1` change-data keys `{}`, zero `condition applied`/no_healing log entries.

## ROOT CAUSE (disk + code)
- monsters.json Dread Scythe row authors the rider as `save_effect:"The target can't regain Hit Points..."` on an ATTACK row with NO `save_dc` and NO `hit_conditions`/`hit_target_effect` → §104 MA-0522/0527 decoy fingerprint.
- no_healing te FAMILY IS LIVE elsewhere: registered te (targetEffectDefinitions.js:136), producer keyed STRICTLY on `action.hit_target_effect` (MonsterCardHelpers.js:528 → handlePlainDamage.js MA-0016/MA-0366 grants), consumers healBlock.js `getHealingBlockEffect`/`isHealingBlocked` + monsterLegendaryUses.js:69 refusal choke point. Row simply not authored into that shape.

## FIX (DATA, one field, MA-0016/MA-0366 template)
Author `"hit_target_effect": "no_healing"` on Dread Scythe row (optionally drop misleading `save_effect` or keep byte-inert). Expiry: RAW "until end of target's next turn" — verify MA-0016 `until_start_of_next_turn`-style clock matches (playbook §38 single-clock rule). Row prose otherwise byte-exact; no code change needed.

## Cleanup
admin clear-change-data + clear-log (200/200) + hard reload; own curl log `[]`, change-data `{}`.

Precedents: MA-0550 (Dao Earthen Maul rider inert = FAIL-b), MA-0522 (Couatl Bite FAIL-b), MA-0366 (identical prose-inert no-heal fingerprint, DATA-fixed).
