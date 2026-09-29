# Bug MA-1551 — Succubus/Incubus Etherealness: plain bold row, zero affordance

**Verdict: FAIL** (row renders plain bold with zero clickable affordance; two presses produce zero log, zero change-data, zero console delta — exact MA-0780 Ghost Ethereality pre-fix twin)

## Row
- Monster: Succubus/Incubus (`succubus-incubus`), Action: Etherealness (`other`)
- Manifest: `{"id":"MA-1551","monster":"Succubus/Incubus","monsterIndex":"succubus-incubus","actionName":"Etherealness","actionType":"other","description":"The fiend magically enters the Ethereal Plane from the Material Plane, or vice versa."}`
- Authored row in `public/data/monsters.json`: `{"name":"Etherealness","description":"The fiend magically enters..."}` — **name + description only**. No `automation`, no `advisory`, no `spell_save_dc`, no `zone`.

## Static root cause — no affordance can arm
`src/components/encounter/MonsterAction.jsx` gates every chip on structured fields; the row name itself is rendered as inert plain bold (`MonsterAction.jsx:405` `<strong>{action.name}.</strong>`). There is **no row-name-match gate** — name-matching against the spell DB never arms a chip:
- `SpellCastLinks` (:82) arms only spellcasting rows (:397 `/^spellcasting$/i`) or utility rows via `utilitySpellNamesFor` (:384) — `isUtilitySpellCastRow` (`MonsterCardHelpers.js:421-429`) requires `spell_save_dc`/`spellcasting_ability` **and** spell-name markup in the description. Etherealness has neither.
- `SelfBuffLink` (:255) requires `isMonsterSelfBuffRow` (`monsterSelfBuff.js:25-27`: `row?.automation?.type === 'monster_self_buff' && !!row.automation.effect`). No automation on this row → null.
- `AdvisoryLink` (:335) requires `isMonsterActionAdvisoryRow` (`monsterActionAdvisory.js:17-19`: `!!row?.advisory`). Absent → null.
- No save DC / attack bonus / dice → `ActionSaveRoll` / `ActionDamageLinks` / `LegendarySpendLink` all null.

Spell-name canonicality is confirmed but irrelevant to the gate: `"name": "Etherealness"` exists in **both** `public/data/spells.json` (5e, Transmutation) and `public/data/2024/spells.json` (Conjuration) — 1 match each. The row-name gate hypothesis (:247/:202 refs) does not exist in the live code.

## Live probe (test-campaign, localhost:5173, Playwright E2E)
- EB search exact `Succubus/Incubus` + `Bandit`, both checkboxes verified `checked:true`, Join Encounter → `Initiative (round 1)`: `Succubus/Incubus 1` (HP 66/66, init 9), `Bandit 1` (init 10).
- Card opened; Etherealness row DOM enumeration (exact markup):
  ```html
  <div class="mc-action "><strong>Etherealness.</strong> <span>The fiend magically enters the Ethereal Plane from the Material Plane, or vice versa.</span></div>
  ```
  **Zero affordance**: no `mc-dice-link`, no `mc-dice-link-selfbuff`, no `role="button"`, no chip of any kind. Plain bold name + sanitized description text.
- Press ×2 on the row name: no popup, no modal, no state change.
- Change-data after presses: `ethereal` appears 3× in the payload, all inside the `combat-ui-viewingMonster` card-echo snapshot (`actions[3]/name`, `actions[3]/description`, flavor `description`) — **no `targetEffects`, no te `ethereal`, no expiry clock** anywhere. Succubus combatant dict: no `activeConditions`/`targetEffects`/`concentration` fields (`concentration: null`).
- Campaign log after presses: 3 entries only, all join artifacts (`encounter joined`, 2× initiative rolls). **Zero `ability_use`, zero grant, zero refusal** (`ethereality_refused` never fires — there is nothing to refuse because there is nothing to press).
- Console: 0 errors; 2 warnings pre-existing/unrelated (`apple-mobile-web-app-capable` deprecation, `automationExpressions` `class_level_scaling` noise present before the presses).

## Fix lane — automation restructure (precedent: Ghost MA-0780)
The `ethereal` te + self-buff machinery now exists app-wide (Spells-group te registered, fa-ghost icon, effect-BRANCHED monsterSelfBuff prose, `already_ethereal` refusal on refire) — proven when MA-0780 was fixed via DATA automation. Apply the identical fix here:
- Author `{"type":"monster_self_buff","effect":"ethereal","rounds":4800}` on the Etherealness row in `public/data/monsters.json` (At Will ungated, 8 h RAW sustain = 4800 rounds clock, ghost precedent).
- `SelfBuffLink` then arms the clickable fa-ghost chip (`MonsterAction.jsx:262` already resolves `effect === 'ethereal'` → `fa-ghost`), routes `resolveMonsterSelfBuffRow` → te `ethereal` on self + merged clock + granted log/popup + refire refusal.

## Cleanup performed
- Admin → Clear Change Data (`keys: []` immediately after), Clear Campaign Log (`log: 0`), Initiative → Clear (`Succubus`/`Bandit` removed, `combat-ui-viewingMonsterCreatureName: null`, 14-player baseline restored identical to session start). All mutations confined to `test-campaign`.
