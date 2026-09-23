# BUG MA-0913 — Gray Slaad · Chaos Claw: random-condition rider inert (FAIL(a))

**Date:** 2026-09-23 · **Verdict:** FAIL(a) — random-condition clause never fires live · **Rig:** localhost:5173, test-campaign ONLY, single tab, ≤4 presses (2 used)

## Expected (ticket description, full incl. table)
> "+8, reach 10 ft. Hit: 9 (1d10 + 4) Slashing plus 11 (2d10) Necrotic. Until start of slaad's next turn, target has condition by 1d4 roll: 1 Charmed; 2 Frightened; 3 Poisoned; 4 Incapacitated."

Card prose byte-renders the full clause incl. the 1d4 table (verified live).

## Actual
- **Damage ✓:** "+8" chip ×2 vs AC12, both straight hits; §140 ledger exact 2/2 (note:"combined_damage_roll", fd+sfd==|hpΔ|):
  - p1 nat19+8=27 HIT: fd "1d10 + 4"[1]=5 Slashing + sfd "2d10"[1,4]=5 Necrotic = 10; hp 999→989 ✓
  - p2 nat11+8=19 HIT: fd[4]=8 + sfd[3,5]=8 = 16; hp 989→973 ✓
- **Condition ✗ inert:** post-each-hit probe ×2: Bandit 1 `activeConditions` null, `activeConditionMeta` null, top-level `targetEffects` null; whole-log `rollType:'chaos-condition'` = 0 entries; `type:'condition'` = 0 entries; expirations = 0. Zero 1d4 roll, zero grant, zero "until start of slaad's next turn" expiry. §MA-0575 seam would log "1d4 → N → Label" — never observed.

## Likely Location
`public/data/monsters.json` → `gray-slaad` → `actions[1]` (Chaos Claw): field **`hit_condition_roll` ABSENT** (confirmed disk dump today; `hit_conditions`/`conditional_damage` likewise absent). Fix = ONE-FIELD data patch, matching the §MA-0575 death-slaad byte-shape (`death-slaad` `actions[1]` Chaos Blade):
```json
"hit_condition_roll": { "die": 4, "conditions": ["charmed", "frightened", "poisoned", "incapacitated"] }
```

## Notes — machine LIVE-unarmed (§MA-0575, cited not re-derived)
- `src/components/encounter/MonsterCardHelpers.js:575` `parseHitConditionRoll` reads `hit_condition_roll:{die,conditions}` → `buildHitConditionClause:597`.
- `src/hooks/combat/handlers/handlePlainDamage.js:581` `maybeApplyHitClause` (:757 on resolved hit) → :587 `rollHitConditionChoice:556` rolls `1d{die}`, logs `rollType:'chaos-condition'` "1d4 → N → Label" (:566-577); :599 grants `conditions[N-1]`; :602-610 `addExpiration expireOnCreatureName=attacker` — "until start of slaad's next turn" fully expressible.
- Trichotomy: description demands the random condition; machine is LIVE and there is an authored byte-shape twin (death-slaad Chaos Blade) ⇒ this is **expressible-but-unauthored** (§MA-0877 shape), NOT honest-unexpressible (§MA-0903 zero-consumer shape) ⇒ exact-damage does not excuse inert rider ⇒ FAIL(a).
