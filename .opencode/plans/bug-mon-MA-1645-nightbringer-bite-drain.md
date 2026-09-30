# BUG MA-1645 — Vampire Nightbringer Bite (actions[1]): HP-max drain + vampire regain both UNAUTHORED/unresolved

**Verdict: FAIL(a)/DATA** — dual-damage axis LIVE byte-exact (2/2 hits), but drain rider absent on disk while attack-lane byte-twin is expressible+live (Specter `hit_hp_max_reduce:{equal_to:"damage"}` monsters.json :56547-56549, MA-1489/MA-0352 family); regain rider is a second-layer grep-zero transport gap (FAIL(b), MA-1639 conclusion preserved).

## Evidence (test-campaign, dev:locked :5173, own curl/DOM truth; header verified test-campaign)

### STEP 1 STATIC
- monsters.json vampire-nightbringer actions[1] keys: name, description, attack_bonus 7, reach "5 ft.", damage_dice_primary "1d6 + 4" Piercing, damage_dice_secondary "3d6" Necrotic. Manifest byte-match ALL fields TRUE (desc byte-exact).
- Structured drain/regain fields: **NONE** — no `hit_hp_max_reduce`, no `hit_target_effect`, no heal/reduce/recover/drain key of any shape on the row.
- Lane grep (precise): ATTACK-lane key is `hit_hp_max_reduce` (NOT attack_hit_hp_max_reduce / not bare hp_max_reduce — that is the te name). Parser `parseHitHpMaxReduce` (MonsterCardHelpers.js:788, structured-key-only, accepts only `equal_to:"damage"`) → `hitClauseRiderPayload` :839 → `buildHitConditionClause` → `maybeApplyHitClause` (handlePlainDamage.js:833) → `applyHitHpMaxReduce` :765 → `hpMaxReduceService.applyHpMaxReduce` (:150, cs maxHp drop + accumulating te ledger {baseMax,reduced,max} + "Max HP Reduced" condition log, no clock, LR clears).
- Save-path twin `save_hp_max_reduce` (saveProcessing.js:1313, MA-1547) N/A here — row attack-shaped (no save_dc).
- REGAIN lane: grep-zero app-wide (`attacker_recover|self_heal|regains Hit Points` etc.) — attacker-side heal folded from damage has ZERO producers/consumers on attack or save lanes; `self_heal` exists legendary-only (MonsterCardModal.jsx:787-788 applyLegendarySelfHeal).

### LIVE RIG (STEP 2-4)
- EB exact-td join: "Vampire Nightbringer"→Vampire Nightbringer 1 (ac16 hp142, idx vampire-nightbringer) + exact "Bandit"→Bandit 1 (ac12); pre-Join checked audit exactly 2 rows.
- cs full-store POST {value:cs} 200: Bandit ac12 + currentHp/maxHp/currentHitPoints/maxHitPoints 999 + resistances:[]; Nightbringer currentHp mid-stamp **100**/142 (regain-visible); targetName "Bandit 1" SAME POST (§491). Readback exact.
- Chip census: Bite row exactly ONE "+7" `.mc-dice-link`; Shadow Strike one "+7"; Multiattack header ZERO; zero DC chips (§119 self-suppress; row-scope strong.startsWith('Bite') mandatory — both components "+7").
- 4 chip presses → 2 attacks (press-1 + press-4 landed; presses 2/3 absorbed on pending/stale stage-2 popup, cached-replay same dice [2],[5,2,2]; log-count adjudicated before/after, §77/§116/§140 family).
- **HIT 1:** nat12+7=19✓AC12 → formula "1d6 + 4" fd 6 Piercing + secondaryFormula "3d6" [5,2,2]=9 Necrotic, note combined_damage_roll, ONE damage entry; hp_change Δ−15 (999→984) brk Piercing6/Necrotic9 resisted:false — fd+secFD==|Δ| unclamped ✓.
- **HIT 2:** nat15+7=22✓AC12 → "1d6 + 4" fd 5 Piercing + "3d6" [6,4,6]=16 Necrotic; Δ−21 (984→963) unclamped ✓. Distinct dice kills cached-replay suspicion.
- **DRAIN ABSENT:** Bandit 1 maxHp **999 FROZEN** on both hits (RAW expected 999→990→974, necrotic-equal). Top-level change-data `targetEffects: null` — Specter te lane never armed.
- **REGAIN ABSENT:** Vampire Nightbringer 1 currentHp **100 FROZEN** on both hits (expected 100→109→125).
- Whole-log scan `hp_max_reduce|Max HP Reduced|max.*decreas|regains|Hit Point maximum`: **0 hits**.
- Console: 0 errors (attack path, none expected).

## Fix (REGISTRY-DELTA proposal, do-not-apply)
1. Drain: author `"hit_hp_max_reduce": { "equal_to": "damage" }` per Specter :56547 byte-shape — BUT honesty flag: consumer magnitude = `applyResult.finalDamage` which on combined_damage_roll rows carries the PRIMARY pool only (secondary rides `secondaryFinalDamage`, handlePlainDamage.js:106/:94; Specter is a single necrotic pool so twin-magnitude==RAW there). Nightbringer RAW drains **equal to NECROTIC (secondary) only** → full-RAW fix needs parser scope extension (accept `equal_to:"secondary"`) + consumer read of secondaryFinalDamage; plain byte-twin would drain the wrong pool (Piercing-only magnitude). One-field for MA-1639 does NOT port cleanly here.
2. Regain: new structured key (`hit_attacker_recover:{equal_to:"secondary"}`-class) + consumer folding attacker HP regain into handlePlainDamage post-roll lane — FAIL(b) transport, zero code today (§MA-1639 item 2 preserved).
3. Interim: GM-enforced advisory for both clauses (MA-1489 te + LR ledger already standing for drain once authored).

## BEFORE/AFTER table
| side | Bandit cur | Bandit max | Nightbringer cur | expected after 2 hits |
|---|---|---|---|---|
| BEFORE | 999 | 999 | 100 | — |
| after HIT1 (6p+9n) | 984 | **999** | **100** | max 990, V 109 |
| after HIT2 (5p+16n) | 963 | **999** | **100** | max 974, V 125 |
