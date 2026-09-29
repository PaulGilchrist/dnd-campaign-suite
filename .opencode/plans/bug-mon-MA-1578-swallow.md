# Bug Report — MA-1578 Tarrasque "Swallow"

**VERIFIED: FAIL**

## Row (manifest MA-1578)

- monster: Tarrasque (`tarrasque`), actionType `save`, actionName `Swallow`
- saveDc: 20, saveType: Constitution
- saveEffect: "Failure: 28 (8d6 + 6) Bludgeoning damage. If the target is a creature, it is swallowed."
- conditions: blinded, prone, restrained
- description: RAW swallow state machine (grapple prerequisite, bite-hit gate, 16d6 acid EOT tick, 60-damage regurgitation gate, death escape)

## Expected (from row)

Pressing the Swallow affordance against Bandit should adjudicate a DC 20 Constitution save and, on FAILURE, pay 28 (8d6 + 6) bludgeoning damage and apply swallowed-state effects (blinded / restrained / prone per row + description).

## Live Evidence (E2E, localhost:5173, test-campaign)

1. **Rendering**: Monster card opens (Tarrasque 1 after initiative join with Bandit 1). Swallow row renders as `strong "Swallow."` + one clickable chip `span.mc-dice-link.mc-dice-link-save.mc-dice-link-save-clickable` labeled **"DC 20 Constitution"** + full prose text. **No damage chip** ("8d6 + 6" never renders as an affordance) — row affordances = 1 (save chip only).
2. **Press 1** (target Bandit 1 set on Tarrasque tracker card): roll popup `popup-modal` shows CON d20 = **10** with banner **"⚠ DC Unknown — no success or failure"** — the authored save_dc 20 is NOT passed to the roller.
3. **Press 2**: same popup, CON d20 = **2**, again **"DC Unknown — no success or failure"**.
4. **Campaign log** (post-press): entries *do* adjudicate the save: `"Bandit 1 Swallow → Bandit 1 CONSTITUTION save DC 20 SAVE FAILURE (10)"` and `(2)` — so a log-level fail verdict exists. **No damage line** (`logHasDamage=false` for 8d6/bludgeoning/acid), **no swallowed line** (`logHasSwallowed=false`).
5. **Fail-face delta**: Bandit 1 HP **11 → 11** across both adjudicated SAVE FAILUREs. Zero damage landed. Zero condition badges added (no blinded/restrained/prone; only pre-existing unrelated "OA Disadv" effect on card). No swallowed-state machinery anywhere.
6. **Static corroboration**: grep shows no "swallow" consumer in resolution code (only comments in `MonsterCardHelpers.js:543` / `handlePlainDamage.js:520`); row has no `damage_dice_primary` field — dice text in save_effect prose is unharnessed.

## Conclusion

The chip resolves a raw CON save roll (roller gets "DC Unknown"; log separately adjudicates FAIL from the authored DC), but the FAILURE face pays **nothing**: no 8d6+6 bludgeoning damage, no conditions, no swallowed state. Number inert → **FAIL(a)** (zero-delta fail face → FAIL(b)-ish within row → FAIL overall).

## Notes

- Full RAW swallow state machine unimplemented: swallowed / blinded / restrained application, 16d6 acid EOT tick, 60-damage regurgitation gate, grapple prerequisite, and death-escape all grep-zero (no consumers anywhere in `src/`/`server/`).
- Secondary defect even in the partial path: save chip popup reports **"DC Unknown — no success or failure"** despite the row authoring save_dc 20 — DC not plumbed into the roll popup (twins: §986 save-chip rendering; MA-1543/1551 zero-affordance family differs — here affordance exists).
- Fix lane: structured save-damage dice field (`damage_dice_primary` "8d6+6" bludgeoning) consumed by the save resolution path so the fail face pays damage, **plus** a swallowed targetEffect/service implementing blinded/restrained/acid-tick/regurgitate gates.

## Cleanup

Admin → Clear Change Data + Clear Campaign Log (test-campaign); initiative cleared via tracker Clear. No production campaigns touched.
