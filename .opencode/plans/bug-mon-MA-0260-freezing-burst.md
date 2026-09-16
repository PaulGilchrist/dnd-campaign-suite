# Bug — MA-0260 Ancient White Dragon "Freezing Burst" (aoe-save)

**VERDICT: FAIL**

## Expected (monsters.json description — canonical)
> "Constitution Saving Throw: DC 20, each creature in a 30-foot-radius Sphere centered on a point the dragon can see within 120 feet. Failure: 14 (4d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. Failure or Success: The dragon can't take this action again until the start of its next turn."

- DC 20 Constitution; fail = 4d6 Cold + **Speed 0 until end of target's next turn**; half on success; **once-per-turn gate**.

### Internal data conflict (confirmed in seed, `public/data/monsters.json` index `ancient-white-dragon`, legendary_actions[1])
- `description`: 14 (4d6) + Speed 0 clause
- `damage_dice_primary`: **4d6**
- `save_effect`: **"Failure: 17 (5d6) Cold damage. Success: Half damage."** — contradicts both fields above and drops the Speed-0 clause.

## Actual (live evidence, test-campaign, AWD cs init 9, header `test-campaign` verified; Vite :5173)
1. **Dice resolved = 4d6 (dice field wins).** Card chip "4d6"; picker text "On a failed save, target takes 4d6 Cold damage."; every log roll `formula:"4d6"`. The drifted 5d6 `save_effect` never rendered in this flow → **cosmetic/latent data drift only** for the dice number.
2. **Damage totals vs hpΔ: consistent (all legs).** Fail legs: EP −20 (113→93), HW −13 (87→74), EP −12 (→81), EP −15 (→66). Success leg: EP d20 14+10=24 ≥ 20 saved; popup "Saved — takes 7 Cold damage (rolled 14, halved)"; log `finalDamage:7`; hpΔ −7 (66→59) = exact floor(14/2). Zero speed effect on success. ✓
3. **NEW anomaly — log dice-array integrity broken.** In every Freezing Burst roll record, `rolls` ≠ `total`: [4,5,4,1]=14 vs total 20; [3,2,1,3]=9 vs 13; [3,4,3,1]=11 vs 12; [1,1,1,2]=5 vs 15; success [1,1,2,3]=7 vs total 15 / popup pre-halve 14. Applied totals always match hpΔ, so the recorded die faces are decoupled from the resolved total (double-roll or logging defect in the aoe-save damage pipeline).
4. **Speed 0 clause: FAIL — inert.** On failed targets: EP `activeConditions:[]`, `activeConditionMeta:{}`, `pendingExpirations:[]`, no `*speed*` change-data key; HW has only pre-existing `paralyzed` (Silver Dragon source, dc 24). No te/badge/key produced. MA-0090 dropped-clause family confirmed.
5. **Once-per-turn gate: FAIL — ungated.** FOUR `ability_use "Freezing Burst: Selecting…"` log entries in one window (ts 1789532716996 / 1789532809731 / 1789532836948 / 1789532916566); picker reopened each click with no refusal, no disabled state, no recharge/uses enforcement. Header economy dead (MA-0259 precedent).

## Likely location
- **DATA:** `public/data/monsters.json` ancient-white-dragon legendary_actions[1] `save_effect` → rewrite to mirror description: "Failure: 14 (4d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. Success: Half damage."
- **Producer:** missing speed-zero te/targetEffect producer on fail leg (MA-0090 family; `stunned_speedHalved`-style consumer exists elsewhere but nothing emits here) + once-per-turn gate (header economy, MA-0259).
- **Secondary:** dice-roll/log integrity in aoe-save pipeline (rolls array vs total).

## Notes
- Picker: Sphere-by-picker accepted (§AoE picker precedent); 30-ft radius picker-adjudicated.
- Cold Breath untouched (mid-recharge `cold_breath_refused` at 1789532423768 respected).
- Mutations limited to in-scope GM-UI action applies (savePrompt/saveResult/log/hp POSTs); no save-file edits, no admin/mutating bypass calls.
- Precedents: MA-0090, MA-0229, MA-0258, MA-0259.
