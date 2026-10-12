# BUG — MA-1940 Ladon "Sleeping Mist (Recharge 5-6)" — recharge name-text never gates

**Verdict: FAIL(b)/DATA — one-field fix `recharge:"5-6"`**
**Row:** MA-1940, stableKey `ladon|actions|3`, actionType aoe-save, DC 23 Constitution, Unconscious on fail, damageless 60-ft Cone.
**Verified live 2026-10-11 via Playwright on http://localhost:5173, test-campaign.**

## Defect (crown axis)
The row's RAW usage "Recharge 5-6" lives ONLY in the action **name text** `"(Recharge 5-6)"`. Disk `public/data/monsters.json` Ladon actions[3] carries **no `recharge` field and no `usage.type:"recharge on roll"` dict**, and `rechargeUsageOf` (src/services/encounters/monsterRecharge.js:35-47) reads only those structured forms → gate `null` → the economy never arms.

### Live machine proof (ungated multi-fire)
- Fire 1: picker confirm → ability_use "Sleeping Mist (Recharge 5-6): Selecting 2 target(s) (DC 23 Constitution)"; Unconscious grants ×2.
- **Immediate re-press (no turn walk, no recovery):** chip fired again — picker reopened, **zero `.mc-recharge-refusal` popup, zero `<slug>_refused` log tokens, chip never gained `mc-dice-link-spell-spent`**.
- Fire 2 landed: second volley adjudicated, Unconscious grants total 4.
- Fire 3 (success-face leg) landed: ability_use count 3 volleys same session.
- `GET /api/campaigns/test-campaign/change-data` after both fires: **`monsterRecharge` ABSENT whole-store** (`JSON.stringify(cd).includes('monsterRecharge') === false`; `Ladon 1.monsterRecharge === null`).

**Fingerprint family:** MA-1916 / MA-1924 / MA-1932 (+MA-1890 Fenrir precedent) — 5th instance. Consumer lane (spend-at-picker-open, `.mc-recharge-refusal`, `monsterRecharge {recharged:false,threshold:5}` stamp, d6 recovery at owner turn-start) is fully live (MA-0031/0488/0618 twins — MA-0618 Garuda and MA-0629 steam breath re-confirmed consumers).

**Fix (DATA, one field):** add `"recharge": "5-6"` to Ladon actions[3].

## PASS-side axes (row mechanics otherwise healthy)
- **Chip audit:** row renders exactly ONE chip `span.mc-dice-link-save-clickable` text "DC 23 Constitution"; zero dice/damage links (damageless ✓); save_dc 23 + save_type Constitution enforced honestly on picker copy ("Constitution saving throw (DC 23)").
- **Shape parse:** "60-foot Cone" parses (breathAoeShape) → SaveAttackAoeModal opens gridless ("GM positions tokens; selection advisory"), all non-attacker targets selectable (§163 MA-0618 twin).
- **FAIL face:** results-modal verdicts "Bandit 1: Failed the save (rolled 2)" / "Bandit 2: Failed the save (rolled 7)" with FULL-word cs rig `saveBonuses.constitution:-15` (§163/§337 picker lane) → both totals < 23. `condition applied` ×2 Unconscious; per-victim change-data `activeConditions:["unconscious"]` + `activeConditionMeta.unconscious {source:"Ladon 1", dc:23, ability:"con"}`; grant description carries RAW duration "Unconscious until the end of its next turn, repeating the save…".
- **Damageless picker route (§409/MA-0663):** ZERO `roll/save` entries, ZERO `roll damage` entries, ZERO `hp_change` on ANY leg, all three volleys — machine truth is results-modal verdict lines + condition-applied entries, exactly as fingerprinted.
- **SUCCESS face:** flipped FULL-word `saveBonuses.constitution:+30` (nat 7/6 + 30 ≥ 23 deterministic) + pre-cleared victims `activeConditions:[]` (§371) → results "Bandit 1: Saved — takes no damage (rolled 7)" / "Bandit 2: Saved — takes no damage (rolled 6)"; **zero new Unconscious grants** (total held at 4), victim conds/meta stayed empty. No "half damage" fabrication despite dc_success unauthored — no damage pool to leak (§63 N/A on damageless).

## Advisory residual (note, do not chase — §70/§346/§598)
Repeat-save-at-turn-end prose ("repeating the save at the end of each of its turns to end the effect early") in `save_effect` is UNSTRUCTURED (no `repeat_save` descriptor) → zero auto-repeat consumer; Unconscious persistence is GM-enforced. MA-1939 same-monster precedent; damageless-cone repeat-save zero-fire re-confirmed.

## Rig / ops notes
- EB: exact-td "Bandit" checkbox native `cb.click()` needed — Playwright ref-click double-toggled OFF (§309); qty stepper "+" native aria-label click land 1-shot → qty 2.
- cs names arrived suffixed "Bandit 1"/"Bandit 2"; Ladon idx0 this session (§370/§598 poll-names honored).
- Full-store cs POST preserved armed `Ladon 1.targetName` when re-stamped; PC placeholders (1/1) joined with monster — excluded from picker selection (Bandits only).
- sp-modal picker confirm landed first click across all three volleys; results modal closed via its own "Close" btn (§196).

## Cleanup
Admin clear change-data + log via curl (200, no dialog), GET-verified `{}` / `[]`, 15s quiet confirm. No manifest/registry writes.
