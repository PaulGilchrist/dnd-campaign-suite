# BUG MA-1652 — Vampire Spawn Bite (actions[2]): HP-max drain + vampire regain both UNAUTHORED/unresolved

**Verdict: FAIL(a)/DATA** — save + dual damage legs LIVE byte-exact on both faces (4/4 presses), but drain rider absent on disk while save-lane byte-twin is expressible+live (`save_hp_max_reduce:{equal_to:"damage"}` Succubus :58472 / Succubus-Incubus :58623, MA-1547/MA-1550 seam → saveProcessing.js:1313 applySaveHpMaxReduceLeg); regain is a second-layer grep-zero transport gap (FAIL(b), MA-1115/MA-1639/MA-1645 frame preserved).

## Evidence (test-campaign, dev:locked :5173, own curl/DOM truth; header verified test-campaign; zero campaign-lock events)

### STEP 1 DISK-KEYS + SUCCUBUS-TWIN
- monsters.json vampire-spawn actions[2] keys (enumerated): `name("Bite"), description, save_dc(14), save_type("Constitution"), range("5 feet"), damage_dice_primary("1d4 + 3"), damage_type_primary("Piercing"), damage_dice_secondary("3d6"), damage_type_secondary("Necrotic"), save_effect` (damage prose only — no canonical condition word, no condition expected).
- Manifest byte-match: description TRUE, saveDc/saveType TRUE, dice/type primary+secondary TRUE, range TRUE, actionType "save" ✓.
- **`save_hp_max_reduce` ABSENT** — Succubus byte-twins on disk: :58472-58474 and :58623-58625 `"save_hp_max_reduce": { "equal_to": "damage" }` (MA-1547/MA-1550 authored templates; Specter attack-lane twin `hit_hp_max_reduce` :56547).
- **`dc_success` ABSENT** → half-default (§523/§809 MV-20 family). RAW row is Failure-only (success silent-zero) → half-default is a leak, note axis; §MA-1547 convention: author explicit.
- **`target_prerequisite` ABSENT** — prerequisite clause ("willing or Grappled/Incapacitated/Restrained") prose-only. Gate lane `evaluateTargetPrerequisiteGate` (Helpers:887) IS called on the save path (MonsterCardModal.jsx:2049 handleSaveRoll) — live-but-unarmed → chip fired 4/4 on clean ungrappled Bandit, zero refusal = unenforced prerequisite, live-unarmed gate (MA-0019/MA-0687 frame; one-field DATA fix available, NOT §70 advisory per §209 conversion).

### LIVE RIG (STEP 2)
- EB exact-td joins: "Vampire Spawn"→Vampire Spawn 1 (ac16 hp90, res[necrotic]) + exact "Bandit"→Bandit 1 (4-row collision family, td[1] exact match); pre-Join checked audits exactly 1 row each. Standing PCs = 1-HP placeholders (§237, ignored).
- cs full-store POST {value:cs} 200, readback exact: Bandit ac12 + currentHp/maxHp/currentHitPoints/maxHitPoints 999 + resistances:[] (clean Piercing+Necrotic victim) + `ability_score_modifiers:{con:-19}` (FAIL-face rig, §MA-1639 lane: ability_score_modifiers.con is the consumed channel at this seam; saving_throws numeric → NaN artifact); Vampire Spawn 1 currentHp **45**/90 regain-visible + targetName "Bandit 1" SAME POST (§491). Mid-rig flip con:+19 via second full-store POST, readback exact.
- Chip audit (MA-1650 twin): Bite row exactly TWO chips — "1d4 + 3" decoy NEVER pressed (§282/§456 twin-chip rule) + "DC 14 Constitution" mc-dice-link-save-clickable pressed ONLY.

### PRESS LEDGER (4 presses, budget ~4, inline single-stage save seam §129/MA-0866)
| press | face | nat+bonus vs DC | verdict | Piercing leg | Necrotic leg | hp chain | drain? | regain? |
|---|---|---|---|---|---|---|---|---|
| 1 | FAIL | 3−19=−16 | ✗ | "1d4 + 3" [2]→fd5 FULL | "3d6" [2,6,5]→fd13 FULL | 999→994→981 | max **999** frozen | Spawn **45** frozen |
| 2 | FAIL | 9−19=−10 | ✗ | [1]→fd4 FULL | [1,2,6]→fd9 FULL | 981→977→968 | max **999** frozen | **45** frozen |
| 3 | SUCCESS | 1+19=20 | ✓ | [3]+3=6→fd3 HALF | [6,6,6]=18→fd9 HALF | 968→965→956 | max **999** frozen | **45** frozen |
| 4 | SUCCESS | 2+19=21 | ✓ | [3]+3=6→fd3 HALF | [4,5,4]=13→fd6 HALF | 956→953→947 | max **999** frozen | **45** frozen |

- Core axis PASSES: DC 14 + Constitution verdicts stamped (victim `roll save` saveDc/saveResult), saveType Con, 8 separate `save-damage` legs (MA-0427 dual transport live), formula/type byte-exact ×4 faces, fd==|hpΔ| per leg unclamped at maxHp 999 (ΣFAIL −31 = 5+13+4+9; ΣSUCCESS −21 = 3+9+3+6), distinct dice each press kills cached-replay suspicion (§77), popup cosmetic "(d20 N + 0)" base-mod while total folds rig (MA-0866 restated).
- Zero-state §1116 CLEAN on success faces: Bandit change-data dict keys `[]` — activeConditions/activeConditionMeta key-absent; top-level targetEffects null; 0 condition/refusal log entries whole session (save_effect carries no condition word — correct, no over-grant).
- **DRAIN ABSENT (FAIL(a)):** Bandit maxHp **999 FROZEN across all 8 hp_change entries** (RAW expected post-fail: 999→986→977, equal to necrotic taken; even under half-default success leak: further −9/−6). Whole-log scan `hp_max_reduce|Max HP Reduced|drain`: **0 hits**. Change-data `regains`/`Hit Point maximum` ×2 = combat-ui-viewingMonster description echoes only (§457).
- **REGAIN ABSENT (FAIL(b), 2nd layer):** Vampire Spawn 1 currentHp **45 FROZEN across all 4 presses** (expected cur + nec taken). Regain lane grep-zero app-wide: `self_heal` legendary-only (MonsterCardModal.jsx:787-788 applyLegendarySelfHeal); no save/attack attacker-recover producer, no te, no parser — MA-1115/MA-1639/MA-1645 transport gap preserved.
- Console: **0 errors** throughout (4 presses, 2 warnings = pre-existing).
- Popup ops: dual-damage stage-2 popup survives el.click()/backdrop (§MA-1638 twin) — flushed reliably via its own `button.popup-close-btn` (MA-1547 chrome: save-chip Done = popup-close-btn); one press re-fire initially intercepted by lingering popup (audit-before-reclick §29); popups:0 after each flush; never .remove(). Final totals judged post-dismiss (§MA-1650 quirk honored).

## Fix (REGISTRY-DELTA proposal, do-not-apply)
1. **DATA one-field drain**: `"save_hp_max_reduce": { "equal_to": "damage" }` on vampire-spawn actions[2] (after save_type, Succubus :58472 byte-placement) → drain lands BOTH faces via MA-1547 seam (fail=full finalDamage, success=halved), te `hp_max_reduce` badge + LR clears existing LONG_REST_TARGET_EFFECT_CLEAR_KEYS.
   - **Magnitude honesty flag (MA-1645 precedent):** seam magnitude = `applyResult.finalDamage` read in applySaveDamage PRE-secondary leg (saveProcessing.js:1356 call-site before applySecondarySaveDamageLeg :1364) → byte-twin drains the **PRIMARY Piercing pool**, while RAW demands necrotic-equal. Succubus twin is single-pool so magnitude==RAW there; full-RAW spawn fix needs parser scope extension (`equal_to:"necrotic"`/"secondary") + secondary-leg-scoped consumer read. One-field lands the drain mechanic; pool-scope is the documented residual.
2. **Regain = FAIL(b) second layer (MA-1115 frame):** needs new structured key (`save_attacker_recover:{equal_to:"damage"}`-class) + consumer folding attacker-side heal into applySaveHpMaxReduceLeg/applyHpMaxReduce lane — zero producers today; interim GM-advisory log.
3. **`dc_success:"none"`** author explicit (§809/§MA-1547 convention): RAW success is silent-zero; unauthored default-half leaked success legs −3/−9 and −3/−6 today (confirmed stamped `dcSuccess:"half"` on victim save entries).
4. **`target_prerequisite`** one-field DATA fix (MA-0019 byte-shape, e.g. `{conditions:["grappled","incapacitated","restrained"]}`): gate live at handleSaveRoll:2049 unarmed today — chip fired 4/4 on clean victim; "willing" has no te vocabulary today = advisory residual (§MA-1639 item 3).

## BEFORE/AFTER
| side | Bandit cur | Bandit max | Spawn cur | expected |
|---|---|---|---|---|
| pre-press1 | 999 | 999 | 45 | — |
| post FAIL×2 | 968 | **999** | **45** | max 977, V cur 67 |
| post SUCCESS×2 | 947 | **999** | **45** | max 962 (half-leak) / 977 (dc_success:none), V cur +15 |

## Pitfalls recorded
- Drain-hammer popup is dual-damage chrome: only `button.popup-close-btn` flushes (el.click/backdrop/first-click survive, §MA-1638); press re-fire silently intercepted by pending popup → real-pointer click TIMEOUT is the fingerprint, flush then re-press (zero phantom rolls — log counted 4/4).
- cs GET envelope returned bare `{combatSummary}` this session; unwrapped both (§MA-1645).
- Board: admin clears land 200 no-confirm via curl post-tab-close (§15/§261); final `{}`/`[]`/`creatures:[]` verified.
