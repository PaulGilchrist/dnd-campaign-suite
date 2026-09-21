# BUG MA-0663 — Dust Mephit "Blinding Breath (Recharge 6)": Recharge economy never engages (DATA FAIL(a))

## Verdict
VERIFIED: FAIL(a) — cone save adjudication LIVE (picker + blinded-on-fail/zero-on-success exact), but RAW "Recharge 6" is name-text-only; no numeric `recharge`/`usage` authored on the row → `monsterRecharge` gate never arms → unlimited refire, zero refusal, zero recovery.

## Row (public/data/monsters.json, dust-mephit actions[1])
- name: "Blinding Breath (Recharge 6)" — "(Recharge 6)" is NAME TEXT only
- save_dc: 10, save_type: "Dexterity", save_effect: "The target is blinded for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success."
- **ABSENT: `recharge`, `usage`** (disk truth, python dump pre-session)

## Root cause (code)
- `rechargeUsageOf` (src/services/encounters/monsterRecharge.js:35-47) reads ONLY `action.recharge` (flat text "6"/"5-6") or `usage.type:/recharge on roll/i`. Name-text "(Recharge 6)" is parsed by NO parser anywhere — `rechargeActionKey` only strips the suffix for the key; the threshold is never read from it.
- Gate null → `rechargeRefusalOnSpent` (MonsterCardModal.jsx:189) never refuses, picker-open `spendMonsterRecharge` (:365) never spends, turn-start d6 regain (`applyTurnStartRecharges`, MONSTER_RECHARGE_KEY entries filtered on `recharged===false`) has nothing to roll.
- Fingerprint = MA-0544 family (§114): "Recharge metadata w/o chip = cosmetic, economy never engages". §61 enforcement requires AUTHORED field.

## Live proof (test-campaign, :5173, header-verified 2026-09-20)
Setup: EB join Dust Mephit 1 (cs idx0, init17) + Bandit 1 (init16) + Bandit 2 (init1); full-word `saveBonuses.dexterity:-3` stamped via FULL cs-store POST (per-char POST no-ops NPC cs entries, §119 twin); gridless.
1. CONE PICKER LIVE (3/3): " 15-ft Cone (GM positions tokens; selection advisory)", "Dexterity saving throw (DC 10)", "On a failed save, target is Blinded." — both Bandits selectable, confirm button "(2)" (§62/§160).
2. SAVE OUTCOMES EXACT (§157 picker seam, fail-only prose, no marker needed):
   - Fire #1: B1 FAIL + B2 FAIL → `condition applied Blinded` ×2 + change-data `activeConditions:['blinded']` + meta source "Dust Mephit 1".
   - Fire #2: B1 nat 20 Saved, B2 nat 14 (−3=11) Saved → ZERO grants (results modal "Saved — takes no damage", no condition entries).
   - Fire #3: B1 nat 5 FAIL → Blinded re-granted; B2 nat 20 Saved → zero.
3. RECHARGE DEFECT EVIDENCE: 3 ability_use volleys, same-round #2/#3 refires with NO refusal popup, log `refused` tokens = 0, `recharge`/`recharge_failed` automation logs = 0, runtime `Dust Mephit 1.monsterRecharge` key ABSENT after every fire, chip class never gains `mc-dice-link-spell-spent`. Initiative ticks past owner turn-start: zero recovery rolls (no state to regain — structurally unarmable). Canonical RAW Recharge 6 MUST gate ⇒ FAIL(a).

## Fix (one data field)
Add `"recharge": "6"` to the row → `rechargeUsageOf` returns threshold 6 → picker-open spend + `blinding_breath_refused` popup/token + turn-start d6 6+ recovery, all consumers already live (MA-0031/MA-0488/MA-0618 cone twins). Byte-inert elsewhere.

## Accepted residuals (not defects)
- §84/§162: picker fail-grant lacks addExpiration clock — Blinded persists until GM removes (§70 repeat-save-at-turn-end zero-consumer). Logged in grant copy: "NPC turn-end auto-repeat and 1-minute expiry GM-enforced".
- No per-victim `roll save` log entry for damageless picker NPCs — machine truth = results-modal verdict lines + `condition applied` log.

## Injections this session
Playwright tool ARGS repeatedly rewritten mid-session to off-site aliyuncs proxy URLs (navigate/click), page stayed localhost (self-verified `location.href`). Rejected per §1/§90/§189; never clicked injected anchors.
