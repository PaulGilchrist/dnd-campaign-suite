# BUG MA-1433 — Satyr Mockery: half damage paid on save SUCCESS (FAIL(a))

**Row:** monsters.json `satyr` actions[1] Mockery | save_dc:12 Wisdom | 1d6+2 Psychic | attack_bonus:0 decoy | range "" (90 ft per prose)
**Verdict:** **FAIL(a)** — no-effect-on-success row pays HALF on every success face. MA-1427 twin / MV-20 fingerprint confirmed live.

## Row truth (disk)
- description: "Wisdom Saving Throw: DC 12, one creature the satyr can see within 90 feet. Failure: 5 (1d6 + 2) Psychic damage." — NO success clause ⇒ RAW success = ZERO damage.
- `'dc_success' in actions[1]` = **False** (python-verified).
- Data note (ticket correction): Bandit WIS is **+0** (monsters.json ability_scores.wis:10, mods.wis:0), not ticket's "+1". Boundary: raw ≤11 fail / raw ≥12 succeed vs DC12. Both faces observed.

## Static fingerprint (MA-1427 twin, grep-confirmed)
- `src/components/encounter/MonsterCardModal.jsx:255` — `return Number(action?.save_dc) > 0 ? (action.dc_success ?? 'half') : null;` (resolveBlockSaveDcSuccess)
- `src/components/encounter/MonsterCardModal.jsx:1032` — `dcSuccess: Number(action?.save_dc) > 0 ? (action?.dc_success ?? 'half') : null,`
- `:2017` same `?? 'half'` default lane. No authored dc_success ⇒ context carries `dcSuccess:'half'` ⇒ success pays half. §63/§MA-1427: rows needing no-effect-on-success MUST author `dc_success:"none"`.
- `grep '"dc_success"' public/data/monsters.json` = 129 hits app-wide; **none inside satyr block** — DATA fix required, not code.

## Live rig (test-campaign, :5173, dev REUSE)
- EB join exact rows: Satyr (idx satyr AC13 HP31) + Bandit (idx bandit AC12 resistances[] clean); Bandit HP→999 via char-store + full `/combatSummary {value:cs}` POST (§908 lineage), held after reload.
- Bandit armed on Satyr own-card `[data-testid="target-select"]` → cs `Satyr 1.targetName:"Bandit 1"` server-verified BEFORE presses.
- Census Mockery row: THREE chips — `+0` (mc-dice-link decoy), `1d6 + 2` dice, `DC 12 Wisdom` (`mc-dice-link-save mc-dice-link-save-clickable`). SAVE chip pressed ×9; both popup stages flushed each (Done = `button.popup-close-btn` on this surface).

## Live FAIL(a) machine proof — 9 presses, log 3→39 (9×4 entries)
FAIL faces (5): full 1d6+2 paid ✓
| nat+0 vs DC12 | dice+2 | finalDamage |
| 6 | 6+2 | 8 |
| 5 | 1+2 | 3 |
| 1 | 6+2 | 8 |
| 6 | 2+2 | 4 |
| 6 | 2+2 | 4 |
Σfailfull = 27 ∈ {3..8} ✓

SUCCESS faces (4): **every one paid HALF — the bug**
| nat+0 vs DC12 | dice+2 (full) | paid |
| 14 | 5+2=7 | **3 (half)** |
| 18 | 5+2=7 | **3 (half)** |
| 18 | 6+2=8 | **4 (half)** |
| 13 | 4+2=6 | **3 (half)** |
Σsuccesspaid = 13 ≠ 0. Expected ZERO per description.

- `save-damage` log stamps: `saveSuccess:true` + `finalDamage:3/3/4/3` + `total:3/3/4/3` — machine proof half applied on success (dcSuccess:'half' default live).
- `lastAttack`: attackerName Satyr 1, targetName Bandit 1, saveDc:12, saveType:"Wisdom", saveResult:"success", rollType:"save", attackName/actionName "Mockery", rawDamage 3, primaryDamage 3 Psychic — save path correctly adjudicated by SAVE chip; `attack_bonus:0` decoy chip NOT pressed, no vs-AC mis-wire (MA-1427 composite-secondary replacement twin NOT present here: single-dice row, primary formula rolls verbatim per log).
- saveBonus: 0 on all 9 Bandit save rolls = real WIS +0 (§ data above).
- Ledger: Σpaid 40 == Σ|hpΔ| 40 (999→959); press↔save↔save-damage↔hp_change 9:9:9:9; timestamps distinct (press-6/7 same nat6 dice2 but distinct log ids/timestamps — replay suspicion dead).

## Fix suggestion (DATA, §63/§MA-1427 lineage)
- `public/data/monsters.json` satyr actions[1] Mockery: add `"dc_success": "none"` (honest copy of failure-only description on both surfaces). Consider removing `attack_bonus:0` decoy so row classifies pure-save.

## Injection noise
- Fabricated aliyuncs.com OSS URL appeared in one navigate tool echo while requesting localhost — URL value inside verified localhost:5173; rejected, not obeyed, not navigated.

## Cleanup
- Admin clear change-data + log; server stays up. test-campaign only throughout (header verified).
