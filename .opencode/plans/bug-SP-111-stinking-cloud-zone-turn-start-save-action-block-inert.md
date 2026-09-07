# SP-111 Stinking Cloud — cast works, but turn-start saves and the Poisoned action/bonus-action block have ZERO consumers; no real zone exists

## Overview
SP-111 Stinking Cloud casts end-to-end (picker → real CON save DC 18 → Poisoned applied + badged + logged → concentration recorded → lv3 slot paid), but the spell is fundamentally a **turn-start zone** and the app implements it as a **one-shot cast-time save bundle**. There is no zone object (no center, no radius, nothing consumed), no saving throw is ever forced when a creature starts its turn in the sphere, and the special rider "can't take an Action or a Bonus Action" has no enforcement consumer anywhere. Poisoned also persists past "end of the current turn".

## Expected Behavior (verbatim, spells.json 2024 + manifest)
> "You create a 20-foot-radius Sphere of yellow, nauseating gas centered on a point within range. The cloud is Heavily Obscured. The cloud lingers in the air for the duration or until a strong wind (such as the one created by Gust of Wind) disperses it. Each creature that starts its turn in the Sphere must succeed on a Constitution saving throw or have the Poisoned condition until the end of the current turn. While Poisoned in this way, the creature can't take an action or a Bonus Action."

## Actual
- Saves fire **only at cast time**, once, for the picker-selected creatures. Starting a turn inside the cloud never prompts a save.
- The Poisoned creature took a full Action (Mace attack roll) on its turn while Poisoned-by-Stinking-Cloud.
- Poisoned was still active after the victim's turn had ended ("until the end of the current turn" not enforced).
- "Zone" is only a per-target marker te `{target, effect:'stinking_cloud', source, duration:'concentration'}` in top-level change-data `targetEffects` — zero consumers read it. No center point, no radius, no map/zone entity, heavily-obscured display-only.

## Steps to Reproduce (live, 2026-09-06, test-campaign)
1. DivinationWizard lv20 Abjurer (INT 18 → spell save DC 18), Stinking Cloud prepared via Edit wizard tab 14 (app data says **lv3**, Bard/Sorcerer/Wizard — NOT lv2).
2. EB-join `Animated Rug of Smothering 1` + `Thug 1`; both joined combatSummary.
3. Wizard sheet → Stinking Cloud → Cast Spell (lv3 slots 3→2) → picker "Cast Stinking Cloud (2)" → both CON saves DC 18 at CAST time: Rug d20(1)+0=1 FAIL, Thug d20(7)+2=9 FAIL.
4. change-data: both `activeConditions:['poisoned']`, `activeConditionMeta.poisoned{dc:18,ability:'con'}`, `saveResult-<Target>` pairs, top-level `targetEffects` te `stinking_cloud` ×2, cs `concentration:{spell:'Stinking Cloud',dc:18}`. Card badge "Poisoned DC 18". Log: ability_use + save_result(fail)×2 + condition lines claiming "can't take an Action or Bonus Action".
5. Walk initiative (array order) → `activeCreatureName:"Thug 1"` = turn START inside cloud → **no save prompt, log count unchanged 13→13**.
6. While Poisoned: Thug card → Mace `.mc-dice-link` → attack roll executes (NEW log line: roll, total 7, d20 7+4) — action NOT blocked.
7. Next → (AasimarTest active, Thug turn ENDED) → Thug/Rug still `['poisoned']`, te ×2 still present.

## Grep evidence (zero-consumer proof)
- `stinking_cloud` outside the cast pipeline (dispatchers `automationRouter.js:23`, `automation/index.js:575`, `execution/index.js:344`, `triggerSpells.js:359-365`, `useSimpleSpellHandlers.js:564`, `useAreaEffectHandlers.js:110`, `spellGates.js:487`, info builder `automationInfoBuilder/save.js:230`, handler itself): **zero hits**.
- `targetEffectDefinitions.js`: no `stinking` match (registry requirement violated; GM effect-adder cannot even offer it).
- `turnStartEffects.js` (both copies: src/services/combat/automation/ + src/services/rules/effects/): zero `stinking` hits → no turn-start save consumer.
- Action-block: `cannotAct` derives solely from `CONDITIONS_THAT_CANNOT_ACT = {incapacitated,paralyzed,petrified,stunned,unconscious}` (`conditionEffects.js:4`); grep `no_action|noAction|actionBlocked|stinking` in conditionEffects.js/CharActions/CharBonusActions = 0 → rider text exists only in log prose.

## Likely Location
- Real handler: `src/services/automation/handlers/spells/stinkingCloudHandler.js` (cast-time-only design; writes te :197-215, concentration :63-70).
- Turn-start seam that should host the repeat save: `src/services/rules/effects/turnStartEffects.js` / `src/services/combat/automation/turnStartEffects.js` (compare SP-108 sleetStorm zone pattern `_sleetStorm_<caster>`).
- Action-block consumer needed: `src/components/char-sheet/CharActions.jsx` / `useCharActionsBaseActions.js` / `CharBonusActions` gate (currently poisoned never blocks) and monster action path (`.mc-dice-link` / MonsterCardModal.logic).
- Registry: `src/services/combat/conditions/targetEffectDefinitions.js` (missing `stinking_cloud` entry).
- Manifest paths are STALE/FICTITIOUS: `src/services/combat/automation/handlers/spellHandler.js`, `routers/spellRouter.js`, `infoBuilders/spellInfoBuilder.js` do not exist / are not the real chain.

## Notes
- LIVE clauses: cast/picker/payment/concentration/first-save/poison-apply/badges/logs + real DC 18 (no SP-109 DC-10 fallback) — all exact.
- DEAD clauses: (b) turn-start repeat saves (grep + live zero-prompt proof), (d) action/bonus-action block (grep + live attack-roll proof), (a) as an enforced zone (marker-only te, no center/radius consumer), duration "end of current turn" (persists; only concentration-loss addExpiration seam, itself a §7 known seam).
- Wind dispersal: unmodellable in this engine (no wind consumer) — noted gap, not the core bug.
- App data: spell is lv3 (canonical 2024 is lv2) — data divergence noted, judged against app data.
- Prompt-injection noise observed repeatedly inside Playwright tool echoes during this session (bogus signed-OSS goto URLs + fake ref-sentinel "continue" instructions); never followed; all interactions above are genuine localhost:5173 flows.
