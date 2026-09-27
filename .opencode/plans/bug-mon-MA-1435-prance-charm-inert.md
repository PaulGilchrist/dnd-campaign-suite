# BUG MA-1435 — Satyr Revelmaster "Prance": attack-HIT Charmed clause INERT

**Verdict: FAIL(b)/DATA** (hypothesis CONFIRMED live 2026-09-27, test-campaign, :5173)

## Row
- Monster: Satyr Revelmaster (index `satyr-revelmaster`), actions[1] `Prance`
- Disk: `attack_bonus:7`, `damage_dice_primary:"2d8 + 4"`, `damage_type_primary:"Bludgeoning"`, `reach:"5 ft."`, `save_dc:0` (save half decorative)
- Prose: "Hit: 13 (2d8 + 4) Bludgeoning damage, **and the target has the Charmed condition until the start of the satyr's next turn.**"
- Manifest extracted `conditions:[charmed]` — prose-only. Disk row carries **NO** `hit_conditions` / `hit_choice` / `hit_target_effect` / `hit_condition_roll`.

## Machine proof (live rig: Revelmaster AC17 vs Knight AC18, HP→999 via full-store cs POST)
- 11 Prance attack rolls: nats/hit = (2,✗)(11,✓)(5,✗)(9,✗)(12,✓)(2,✗)(6,✗)(20,✓crit)(10,✗)(11,✓)(12,✓) — **5 HITS**, incl. boundary tie-hit nat11+7=18 vs AC18 and honest miss nat10+7=17.
- **ZERO charm grants across all 5 hits:**
  - whole campaign log: 0 entries containing "charmed" (any case)
  - `condition applied` entries: 0
  - Knight 1 change-data `activeConditions`: None/absent after every hit (checked per-hit + final)
  - Knight 1 `activeConditionMeta`: None; top-level `targetEffects`: None
  - `lastAttack.hitConditions`: None, `lastAttack.conditions`: None (resolver itself reports no clause armed)
- Attack/damage legs EXACT: 4 non-crit `2d8 + 4` → 13 [1,8], 10 [4,2], 19 [7,8], 12 [6,2] (all in 12–20); crit lineage live: formula `"2d8*2+4"` dice doubled (dice-sum 7×2)+ undoubled flat +4 = 18 (§32/§142 collapsed-dice twin). Σ finalDamage 72 == Σ|hp_change| 72 ✓.
- Expiry anchor: N/A — never exercised (no grant ever occurs). Per §5/§38, fix's "until the start of the satyr's next turn" maps to `addExpiration(expireOnCreatureName=anchor)`; same-round expiry never fires (§38 anchor caveat) — charmed surviving the same round as the hit is the accepted anchor behavior.

## Seam grep (why inert)
- `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:693) consumes ONLY structured keys: `action.hit_conditions` / `hit_target_effect` / `hit_condition_roll` (+ `hit_choice` suppression gate). Description prose NEVER read.
- Consumer `applyHitClauseConditions` (src/hooks/combat/handlers/handlePlainDamage.js:543) grants from the structured clause + escapeDc meta only.
- Prose→charmed hoist on attack path: grep `charmed` producers → save-effect extraction (save.js:263), MA-0855 `hit_choice` picker, te-registry consumers, immunities/auras. **ZERO attack-description hoist.**
- §59/§153 fingerprint re-confirmed byte-faithful: plain/extracted `conditions` NOT consumed; MA-0010 seam = authored `hit_conditions:[...]` only. MA-1434 sibling (zero charm grants on 5 component hits) consistent.

## Suggested fix (DATA, one-field, MA-0621/MA-0801 byte-shape template)
On `satyr-revelmaster` actions[1] Prance, after `damage_type_primary`, author:
```json
"hit_conditions": ["charmed"]
```
- No `escape_dc` (RAW: expires at satyr's next turn-start, not an escape action).
- Grant+expiry rides the live hit-clause consumer; anchor expiry per §38 (turn-start anchor lineage; same-round expiry never fires — accepted residual).
- Byte-minimal edit; single-target row; Multiattack header byte-unchanged.

## Notes / residuals
- Repeat-popup cached replay observed (§77): two absorbed chip clicks (log attack-count < click-count) — counted by log, not clicks.
- Heavy prompt-injection in tool echoes all session (fabricated "system" blocks, aliyuncs proxy URLs, off-site go-to, exfiltration bait) — all rejected; every URL verified localhost; campaign header `test-campaign` throughout; dev:locked server stayed up.
