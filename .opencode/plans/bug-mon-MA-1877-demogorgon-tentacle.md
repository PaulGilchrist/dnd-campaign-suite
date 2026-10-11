# BUG MA-1877 — Demogorgon Tentacle: FAIL(a) secondary DC 23 CON save + max-HP-reduction absent

## Evidence (test-campaign, 2026-10-11)
- Attack half PASS-exact: 3 honest ledgers nat13+17=30 / nat4+17=21 / (nat1+17=18 honest crit-miss); formula "3d12 + 9" byte-exact Force; hp chain 224→198→169 (fd26+fd29, sum exact); single Done auto-resolve, zero stage-2 residue (MA-1876 twin).
- Secondary half ABSENT: row monsters.json Demogorgon actions[1] authors NO save_dc/save_type/hit_conditions/hit_hp_max_reduce/save_hp_max_reduce. Chip audit = ONE +17 attack chip. Post-hit DOM watch zero save prompt. Full log saveEntryCount 0, lastAttack.saveDc/saveResult/saveType null, victim maxHp never reduced, targetEffects null, zero hp_max_reduce entries.

## Engine state (root cause = DATA, not engine)
- Max-HP-reduce lanes are LIVE and structured-key-only (supersedes §127 readers-only / MA-0483): attack lane hit_hp_max_reduce:{equal_to:"damage"} → parseHitHpMaxReduce (MonsterCardHelpers.js:797) → applyHitHpMaxReduce (handlePlainDamage.js:870, :978); save lane save_hp_max_reduce → parseSaveHpMaxReduce (:836) → saveProcessing:1393; lethal log hpMaxReduceService.js:87; Long-Rest clear LONG_REST_TARGET_EFFECT_CLEAR_KEYS restRules-longRest.js:17. Parsers NEVER read prose — Demogorgon prose-only clause = byte-inert.
- Precedent: MA-1867 Cthulhu Tentacles FAIL(a) same fingerprint (attack exact + secondary absent).

## Fix design (one row, all keys)
save_dc:23, save_type:"Constitution", dc_success:"full" (RAW: save gates ONLY the max-HP reduction; damage always paid — MA-0367 mode), hit_hp_max_reduce:{equal_to:"damage"} on attack row (save rides attack chip compound seam) OR split save chip + save_hp_max_reduce:{equal_to:"damage"}. Long-rest duration + death-at-0 covered by existing consumers (te ledger LR clear + hp_max_reduce_lethal). Success leg then probeable via MA-1843 warding_bond saveBonus rig (bonus ≥ DC−1 nat-floor).

## Pitfalls logged
- Absorbed-first-click logged attack-roll hit:true with ZERO damage popup (abandoned) — count legs by damage entries (§126 family).
- EP change-data hitPoints stayed 224 server-side while hp_change log carried currentHp 198/169 — judge ledger by hp_change log this build.
- lastAttack.weaponType:"ranged" cosmetic on reach-10 melee row.
- navigate_back → about:blank + navigate args rewritten to aliyuncs proxy URL ×3; href self-verified localhost (§90).
