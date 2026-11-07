# Bug: Devious Strikes Poison / Knock Out — advertised repeating save never fires (te key mismatch)

## Summary
Devious Strikes (Cunning Strike) Poison grants `poisoned` with an authored `repeatingSave: true`
and the chooser copy "Poisoned (1 min, repeating)" — and the Knock Out feature description says
"repeats save at end of each turn". But the generic turn-END repeat-save consumer reads a
DIFFERENT key (`te.repeatSave`, object) than what the rider writes (`te.repeatingSave`, boolean),
so the victim is NEVER offered the repeat save and the condition never ends via save success —
only via rest/new-initiative/admin clear.

## Steps to reproduce
1. In test-campaign, grant a fixture Rogue (e.g. sanctioned EvasiveFighter disk surgery to
   2024 Rogue/Arcane Trickster lv20 + Poisoner's Kit in `inventory.backpack` — playbook §7 grant recipe).
2. Build a 3-creature board (EF attacker, ElderPaladin victim, third adjacent), activate a token map,
   stamp EP bucket `warding_bond saveBonus:-19` (forced-save-fail dial, playbook §7).
3. On EF's sheet press the Scimitar row; arm target ElderPaladin; on the hit drain to the
   "Devious Strikes — Choose up to 2 effects" `.sp-overlay` chooser.
4. Tick **Poison** → Apply Effects → Roll Save (EP fails CON DC15) → Done; dismiss the
   Shield Bash rider chooser (Cancel) and drain to CLEAR.
5. Verify grants: root `targetEffects` has row
   `ElderPaladin|option:Poison|effect:poisoned|duration:1_minute|repeatingSave:true` and the EP
   bucket `activeConditions:["poisoned"]` (initiative badges Poisoned + Attack Disadv render).
6. Walk Initiative with **Next →** past ElderPaladin's own turn (two clicks: EF→EP, EP→DM).

## Expected behavior
Per the chooser copy "(1 min, repeating)", the classes.json option (`repeatingSave:true`), and the
engine's own precedent (thri-kreen bite `thri_kreen_bite_poison`, whose te carries a `repeatSave`
OBJECT consumed by `repeatSaveService.applyRepeatSaveTurnEnd` — success strips te + condition),
EP's outgoing turn-END should roll a repeat CON save: a log row (save_result / ability_use),
and on success eviction of the te row + `poisoned` condition.

## Actual behavior
Zero observable delta across the turn walk: no new log rows at all (log length unchanged),
no `.sp-overlay` prompt, the `1_minute` poison te row byte-untouched, EP `activeConditions`
still `["poisoned"]`. No expiration clock exists either (`pendingExpirations: []`), so the
condition outlives its authored duration by any save-means — only rest/new-initiative/clear ends it.

## Likely location (confident — code census confirms live observation)
- Writer: `src/services/automation/handlers/combat/attackRiderHandler.js` → `buildRiderEffect`
  copies `repeatingSave: !!option.repeatingSave` (BOOLEAN) onto the te row (line ~585).
- Data: `public/data/2024/classes.json` "Devious Strikes" options — Poison AND Knock Out carry
  `"repeatingSave": true`; the consumer never sees this key.
- Consumer: `src/services/rules/features/repeatSaveService.js` `applyRepeatSaveTurnEnd` filters
  `te.repeatSave && typeof te.repeatSave === 'object'` (line ~128), wired at
  `src/components/initiative/navigationHandlers.js:240` (MA-0610 seam — the seam itself works;
  thri-kreen/whirlwind rows register `repeatSave` objects via `grantRepeatSaveEffect` and are
  honored).
- Secondary data flaw found en route: the same classes.json options carry
  `"saveAbility": "DEX"` on Poison/Daze/Knock Out (saveType is correctly CON). `saveAbility` is
  read in `conditionEffects.js` transport lanes (`effects.saveAbility = te.saveAbility`); if anyone
  wires the repeat leg by copying `saveAbility`, it would roll the WRONG save. Live primary save
  used saveType (CON) correctly.

## Suggested fix
In `buildRiderEffect`, additionally emit the consumer's contract for options with
`repeatingSave:true`: `repeatSave: { effect: option.effect, save_type: option.saveType, dc: <resolved ability DC>, condition: option.condition }`
(following `grantRepeatSaveEffect`'s descriptor shape), OR extend `applyRepeatSaveTurnEnd`'s
filter to also accept `te.repeatingSave === true` rows and derive ability/DC from
`saveType`/`saveDc:'ability'` (resolving vs the SOURCE's save DC — Poison uses DC 15 from EF's
ability DC, which the first save already computed). Fix the `saveAbility:"DEX"` mislabels on the
CON-save options in classes.json while in there. Add a ledger test mirroring
`repeatSaveService`'s existing turn-END ledgers with a rider-shaped te.

## Severity
Broken feature (small blast radius). The debuff-grant half works; the RAW terminator the app's own
copy promises ("repeating") is inert, so Poisoned/Unconscious victims stay penalized for the whole
combat with no escape roll. Confirmed live (zero log/prompt delta walking the victim's turn) +
grep census (zero consumers of `repeatingSave` app-wide).

## Resolution
FIXED 2026-11-07 (fix-verify descent).

**What was actually wrong.** The diagnosis held: `buildRiderEffect` (attackRiderHandler.js) copied
`repeatingSave: !!option.repeatingSave` as a BOOLEAN while the generic turn-END roller
`repeatSaveService.applyRepeatSaveTurnEnd` (navigationHandlers MA-0610 seam) filters
`te.repeatSave && typeof te.repeatSave === 'object'`. Zero rider te rows ever carried the object,
so the advertised "1 min, repeating" save never fired. Reproduced live pre-fix: DS Poison granted
on ElderPaladin (`repeatingSave:true` te + `activeConditions:["poisoned"]`), walked initiative past
EP's own turn — log length byte-identical (5 rows), zero prompt, te untouched.

**One claim in the bug file was WRONG and was NOT acted on:** the "secondary data flaw" —
`saveAbility:"DEX"` on the CON-save options is NOT a mislabel. `buildSaveDc` (savePrompt.js:39-44)
reads `saveAbility` as the DC-SOURCE ability for `saveDc:'ability'`, and the 2024 Cunning Strike DC
is 8 + PB + **Dexterity** by RAW for EVERY option (which is why Trip/Obscure carry DEX too, and why
live DC 15 matched). Flipping it to CON would have broken the primary-save DC. The repeat-save
descriptor therefore stores `saveType` (the target's saving ability, CON) + the resolved numeric
`dc` — the same save vs the same DC, exactly RAW. `classes.json` untouched.

**Fix (writer side only — the consumer was already fully ledgered):**
- `src/services/automation/handlers/combat/attackRiderHandler.js` — `buildRiderEffect` now also
  emits the consumer's contract for `repeatingSave && saveDc` options:
  `repeatSave: { saveType, dc: buildSaveDc(option, playerStats), condition: lower(condition) }`
  (grantRepeatSaveEffect descriptor shape). The authored boolean is kept. Pre-save contamination is
  gated by `resolveOneRepeatSave`'s hasCondition check (condition only exists post-fail), and save
  SUCCESS evicts the whole row via the existing `evictSavedRiderEffect` lane. Sibling fix
  `registerRiderConditionExpiry` (f19ecf028) untouched — Poison/KO still fail its duration-token
  check and stay clockless by pin ("the repeat-save lane owns termination"), which is now TRUE.
- Blast radius (all RAW-correct, same handler lane): Devious Strikes Poison + Knock Out, Cunning
  Strike Poison (lv6/12/14 rows), Soulknife Rend Mind (lv17, repeats WIS save vs stun). Handler is
  ruleset-shared; 5e data authors `repeatingSave` only on the slow spell (not an attack_rider), so
  no 2024/5e twin module change was needed.

**Regression test:** `attackRiderHandler.repeat-save-descriptor.test.js` (new, co-located; mirrors
daze-expiry + repeatSaveService ledger conventions) — 6 ledgers: exact descriptor bytes for
Poison/Knock Out, NO key for Trip, success-eviction (no descriptor residue), and TWO integration
legs running the emitted rider-shaped te through the REAL `applyRepeatSaveTurnEnd` (success strips
te + condition + logs; fail keeps te byte-identical, save owed next turn).
Results: new file 6/6; touched area (`handlers/combat/` + `rules/features/repeatSaveService` +
`components/initiative/`) 147 files / 1442 tests green; char-sheet DS-pin files
(`useAttackDamageResolution.classFeatures` + `modals/shared/` + `conditionEffectsCompute`) 97 files
/ 758 tests green; `npm run lint` zero problems; `no-timers-guard` OK.

**Live re-verification (test-campaign, same repro steps re-run):** post-fix code granted
`repeatSave:{"saveType":"CON","dc":15,"condition":"poisoned"}` on the te row (DC 15 = the primary
save's resolved ability DC). Walked initiative to ElderPaladin's turn-END: a "Saving Throw Required
— ElderPaladin must make a CON saving throw. DC 15" prompt FIRED (it never existed pre-fix); with
the +19 dial flipped it resolved as log rows `save_result (save-repeat) "ElderPaladin succeeded its
repeat CON save (DC 15, rolled 9 + 29 = 38) — poisoned ends on itself."` + `condition removed
"poisoned ends (repeat save succeeded)"`, te row evicted (`targetEffects:[]`), `activeConditions:[]`.
Adjacent sanity: primary rider save still fails/grants honestly on the -19 face, Charge/Shield-Bash
riders drained clean, damage landed (`1d6+3 + 9d6 [Sneak Attack]`).

**Cleanup:** EvasiveFighter disk restored byte-exact (md5 0df29ff3… + API GET re-proves
Fighter/Battle Master/18 + backpack [Shortsword]); Admin panel Clear Change Data + Clear Campaign
Log accepted (dialogs handled); tab closed; two-pass GET-verified `change-data {}` + log `[]`.

## Summary
Devious Strikes (Cunning Strike) Poison/Knock Out advertised a "repeating" end-of-turn save but the
rider writer stamped only a `repeatingSave:true` BOOLEAN while the generic turn-END roller
(repeatSaveService) consumes a `te.repeatSave` OBJECT — the repeat save never fired and the
condition never ended on a save success. `buildRiderEffect` now also emits the consumer's
descriptor (`{saveType, dc=resolved ability DC, condition}` — grantRepeatSaveEffect shape), keeping
the authored boolean; save-success eviction and the f19ecf028 clockless-by-pin stay intact. The
claimed `saveAbility:"DEX"` data flaw was disproved (it is the RAW DEX-based Cunning Strike
DC-source; classes.json untouched). Live-verified: repeat CON DC15 prompt fires at the victim's
turn-END, success strips te + poisoned with `save_result(save-repeat)` + `condition removed` rows.
New ledger `attackRiderHandler.repeat-save-descriptor.test.js` 6/6; touched area 1442 green; lint
clean.
