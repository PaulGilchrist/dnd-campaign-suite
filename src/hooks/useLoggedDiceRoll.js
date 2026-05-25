import useDiceRoll from './useDiceRoll.js';
import { rollD20 } from '../services/diceRoller.js';

export default function useLoggedDiceRoll(characterName, campaignName) {
  const { popupHtml, setPopupHtml } = useDiceRoll();

  function logEntry(entry) {
    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(entry)
      }).catch(() => {});
   }

  function logAndShow(name, bonus, rollType) {
    const r1 = rollD20();
    const r2 = rollD20();
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
        isNatural1: r1 === 1
         });
    setPopupHtml({ type: 'd20', rollType, name, rolls: [r1, r2], bonus });
     }

   function logDamageAndShow(name, formula, total, rolls, modifier) {
       logEntry({
          type: 'roll',
           characterName,
            rollType: 'damage',
              name,
               formula,
                rolls,
                 total,
                  modifier
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
       rollAttack: (name, hitBonus) => logAndShow(name, hitBonus, 'attack'),
   rollDamage: (name, formula, total, rolls, modifier) => logDamageAndShow(name, formula, total, rolls, modifier)
        };
       }
