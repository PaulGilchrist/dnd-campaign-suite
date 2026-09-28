# BUG MA-1531 — Stirge "Proboscis": hit attach rider zero-state (FAIL(a)/DATA)

**Row:** stirge|actions|0 | +5 melee, reach 5 ft., 1d6 + 3 Piercing.
**Verdict:** FAIL(a) — core Proboscis damage adjudicates exact both faces (incl. crit §32), but RAW hit-clause "the stirge attaches to the target" has ZERO transport: no structured field on the row, no attach state machine, and NOT documented as GM-adjudicated advisory for THIS row. MA-1520/1530/1451/1489 zero-state hit-rider standard. One-field DATA fix exists (darkmantle byte-shape).

## Static (disk public/data/monsters.json stirge.actions[0])
- Keys: name/description/attack_bonus:5/reach:"5 ft."/damage_dice_primary:"1d6 + 3"/damage_type_primary:"Piercing" — core complete ✓.
- hit_conditions ABSENT | hit_target_effect ABSENT | automation ABSENT → attach PURE PROSE (§118/§918: hit path reads structured keys only, MonsterCardHelpers buildHitClause :693 family).
- 2024 twin: none (grep zero public/data/2024/).
- PRODUCER PRECEDENT: darkmantle Crush authors `hit_target_effect:"attached"` (monsters.json:15956) → handlePlainDamage.js:642 applyHitClauseTargetEffect registers te → conditionEffects.js:358 stamps attachedBy. Stirge row lacks the field → zero transport. Fix = one field, byte-shape at :15956.
- te `attached` registered (targetEffectDefinitions.js:1219) but darkmantle-specific label/copy ("Attached (Darkmantle)", DC13 Athletics detach). Registry comment codifies the deeper residual: "attach/detach/suffocation state machine is unbuilt (§69 grapple-family advisory, MA-0434 advisory-duration family)" — same accepted shape will cover stirge once the stamp is authored.
- Proboscis block ("can't make Proboscis attacks while attached"): grep `proboscis` src/ = ZERO — no consumer.
- Start-of-turn 2d4 Necrotic tick: turnStartEffects.js has grapple_damage (PC Unarmed Fighting only :527), infernal_wound (MA-0367 te-specific), whirlwind, holy nimbus — NO attach-driven monster bleed tick producer/consumer app-wide (§70 grapple state-machine advisory family).

## LIVE E2E (test-campaign, Playwright only; board admin-cleared post MA-1530, re-joined EB "Stirge" exact + "Bandit" AC12 resistances[] clean, HP rigged 999 via card input)
| # | d20 | +5 vs AC12 | face | damage | hpΔ | attach state after |
|---|---|---|---|---|---|---|
| 1 | nat1 | 6 | MISS (crit miss) | 0 | 0 | none |
| 2 | nat12 | 17 | HIT | 1d6+3=[6]+3=9 Piercing | −9 (999→990) ✓ | te null / conds null |
| 3 | nat20 | 25 | CRIT | "1d6*2+3 (5)"=13, flat undoubled §32 | −13 (990→977) ✓ | te null / conds null |
- 4th chip click = cached-replay of press-2 popup, ZERO log delta (§77/MA-1441) — 3 attack-roll entries count clicks honestly.
- Attach audit post-hits: cs Stirge 1/Bandit 1 targetEffects null, activeConditions null, zero `attach*` keys; whole-log grep `attach|attached|necrotic|2d4|grapple` = **0** entries. change-data hits only in combat-ui-viewingMonster prose snapshot.
- Rider-block probe: press 3 fired while "attached" RAW — NOT blocked (no attach state ever armed; nothing to block with).
- Start-of-turn tick probe: initiative walked to round 3; `__initiative__.lastAppliedTurnStartCreature` gate passed `3:Stirge 1` (machine truth) — Bandit 1 HP 977→977, no necrotic roll, no tick log. ZERO-STATE tick.

## Fix design
1. DATA (one field): stirge.actions[0] += `"hit_target_effect": "attached"` (darkmantle :15956 byte-shape) → attach STATE STAMP live via existing producer/consumer chain.
2. Registry copy: generalize/extend te `attached` description (or stirge variant key if fields differ) to carry stirge copy: 2d4 Necrotic at stirge turn start, detach 5 ft movement / action by target or within-5-ft — GM-enforced advisory.
3. Accepted residual (do NOT rebuild without ticket, §69/§70/MA-0434): while-attached Proboscis block, 2d4 turn-start tick, movement-cost detach — state machine unbuilt family (identical darkmantle MA-0553 carve-out).
4. Siblings to audit same pass: any row with "attaches to the target" prose lacking hit_target_effect (grep monsters.json prose "attaches" vs authored field census).

## Cleanup done
Admin UI Clear Change Data + Clear Campaign Log (dialogs accepted; verified server-side after: log + keys re-populated ONLY by this run's own turn-walk — final cleared). test-campaign header verified at every nav; MA-1532 = next monster (Stirge single-action, block ends here).
