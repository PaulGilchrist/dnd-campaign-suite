# BUG MA-0443 — Bugbear Warrior Grab: Grappled-on-hit inert (DATA class, flavor b)

**Row:** MA-0443 | bugbear-warrior | actions[0] "Grab" | +4, 2d6+2 Bludgeoning, reach 10 ft., "If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12)."
**Verdict:** FAIL — to-hit + damage fully live; grapple clause zero-lands.

## Root cause (static, disk-verified)
`public/data/monsters.json` bugbear-warrior actions[0] authors ONLY:
`name, description, attack_bonus:4, reach:"10 ft.", save_effect(prose), damage_dice_primary:"2d6 + 2", damage_type_primary:"Bludgeoning"`.
**ABSENT: `hit_conditions`, `escape_dc`, `hit_target_effect`, `automation`, plain `conditions`.**

Consumer seam (MA-0010): `MonsterCardHelpers.js:526 buildHitConditionClause(action)` reads ONLY `action.hit_conditions` (+ `hit_target_effect`); returns `null` when absent → `MonsterCardModal.jsx:656 hitClause:null` → `handlePlainDamage.js maybeApplyHitClause` early-returns → `applyHitClauseConditions` (canonical activeConditions + activeConditionMeta{dc,ability:'str'} + `type:condition` log, Medium-or-smaller gate present) never reached. No fallback consumer of plain `action.conditions` (grep-zero); `save_effect` parsers are all save-path gated (require save_dc/save shell — Grab is an attack row, never routed there).
Twin precedents: MA-0434 (Brown Bear Claw/Prone), MA-0288 (Ankheg), MA-0287 (Rug), MA-0354 (Barbed Devil Claws grapple prose-only).

## Live proof (test-campaign, 2026-09-18, localhost:5173, reused session)
- Rig: EB exact-row join → cs "Bugbear Warrior 1" idx0, init 10, AC14, HP 33/33, Medium. Target armed AasimarTest (Medium, AC12) on attacker's OWN initiative-card select (cs targetName verified).
- 12 Grab-chip rolls vs AC12 (`span.mc-dice-link` "+4" in `.mc-action strong` "Grab"):
  - HITS (7): nat8→12 (boundary), nat13, nat10, nat20 CRIT, nat19, nat17, nat12
  - MISSES (5): nat7→11 (boundary flip), nat5→9, nat3, nat2, nat3
  - Log `rolls[0]`=raw d20, bonus separate, `hit` flag decisive; boundary flip decisive nat8=12 HIT vs nat7=11 MISS.
- Damage (7 entries, 1:1 with hits; misses zero): formula "2d6 + 2"; totals==finalDamage==|hp_change|: 11, 12, 9, 16(crit "2d6*2+2 (1,6)" dice-only doubled, flat +2 undoubled), 8, 10, 10. Chain 143→67 = −76 exact (7 hp_change −11,−12,−9,−16,−8,−10,−10).
- **GRAPPLE: `type:condition` log entries = 0 across 7 hits.** AasimarTest `activeConditions=None`, `activeConditionMeta=null` post-debounce; "grapple" appears in change-data only inside prose strings (description/save_effect), never as state. escape_dc 12 recorded nowhere (moot — condition never lands; escape-UI absence is the accepted MA-0287/0288/0354 residual and NOT the failure basis).
- Immunity gate: advisory only — warrior `immunities:[]`, no cheap immune victim exists; skipped.

## Fix = DATA (MA-0302 template)
Add to monsters.json bugbear-warrior actions[0]:
```json
"hit_conditions": ["grappled"],
"escape_dc": 12
```
Byte-unchanged everything else; consumer already live incl. Medium-or-smaller gate + STR escape badge meta (MA-0434 claw precedent). Sustained-grapple state-machine remains accepted residual (§9).

## Registry note
Bugbear Warrior NEWLY placed in test-campaign initiative; change-data + log Admin-cleared at session end.
