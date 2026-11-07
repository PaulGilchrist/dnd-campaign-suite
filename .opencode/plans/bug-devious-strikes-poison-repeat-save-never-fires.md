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
