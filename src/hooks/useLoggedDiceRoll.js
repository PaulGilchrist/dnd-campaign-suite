import useDiceRoll from './useDiceRoll.js';
import { rollD20 } from '../services/diceRoller.js';
import utils from '../services/utils.js';
import storage from '../services/storage.js';
import { getTargetFromAttacker } from '../services/damageUtils.js';

export default function useLoggedDiceRoll(characterName, campaignName) {
  const { popupHtml, setPopupHtml } = useDiceRoll();

  function logEntry(entry) {
    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(entry)
      }).catch(() => {});
   }

  function logAndShow(name, bonus, rollType, context) {
    const r1 = rollD20();
    const r2 = rollD20();

    const combatSummary = (() => {
      const stored = localStorage.getItem('combatSummary');
      if (!stored) return null;
      try { return JSON.parse(stored); } catch { return null; }
    })();

    const target = combatSummary ? getTargetFromAttacker(combatSummary, utils.getFirstName(characterName)) : null;

    const hit = target ? (r1 + bonus >= target.ac) : undefined;
    const targetName = target?.name || context?.targetName;
    const targetAc = target?.ac || context?.targetAc;

    logEntry({
       type: 'roll',
       characterName,
       rollType,
       name,
       rolls: [r1, r2],
      mode: 'normal',
     total: r1,
       bonus,
       isNatural20: r1 === 20,
        isNatural1: r1 === 1,
        targetName,
        targetAc,
        damageType: context?.damageType,
        hit,
        resistanceNotice: context?.resistanceNotice
         });
    setPopupHtml({
      type: 'd20',
      rollType,
      name,
      rolls: [r1, r2],
      bonus,
      targetName,
      targetAc,
      hit,
      resistanceNotice: context?.resistanceNotice,
      forcedMode: context?.forcedMode,
      isAutoCrit: context?.isAutoCrit
    });

    if (rollType === 'initiative') {
        const firstName = utils.getFirstName(characterName);
        const stored = localStorage.getItem('combatSummary');
        if (stored) {
            try {
                const combatSummary = JSON.parse(stored);
                const creature = combatSummary.creatures.find(
                    c => c.type === 'player' && c.name === firstName
                );
                if (creature) {
                    creature.initiative = String(r1 + bonus);
                    combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
                    storage.set('combatSummary', combatSummary, campaignName);
                    window.dispatchEvent(new CustomEvent('initiative-rolled'));
                }
            } catch (e) { /* ignore parse errors */ }
        }
    }
     }

   function logDamageAndShow(name, formula, total, rolls, modifier, context) {
       logEntry({
          type: 'roll',
           characterName,
            rollType: 'damage',
              name,
               formula,
                rolls,
                 total,
                  modifier,
                  damageType: context?.damageType,
                  targetName: context?.targetName
                });
         setPopupHtml({ type: 'damage', name, formula, rolls, bonus: 0, modifier });
          }

     return {
           popupHtml,
            setPopupHtml,
        rollAbilityCheck: (name, bonus) => logAndShow(name, bonus, 'check'),
     rollSavingThrow: (name, saveBonus) => logAndShow(name, saveBonus, 'save'),
   rollSkillCheck: (name, bonus) => logAndShow(name, bonus, 'skill'),
    rollInitiative: (initBonus) => logAndShow('Initiative', initBonus, 'initiative'),
       rollAttack: (name, hitBonus, context) => logAndShow(name, hitBonus, 'attack', context),
   rollDamage: (name, formula, total, rolls, modifier, context) => logDamageAndShow(name, formula, total, rolls, modifier, context)
        };
       }
