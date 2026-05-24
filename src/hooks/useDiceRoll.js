import usePopup from './usePopup.js'
import { rollD20, rollDice } from '../services/diceRoller.js'
import './useDiceRoll.css'

export default function useDiceRoll() {
  const { popupHtml, setPopupHtml } = usePopup(() => null);

  // Internal helper to trigger a d20 roll with its counterpart for adv/disadv
  const triggerD20Roll = (name, bonus, type) => {
    const r1 = rollD20();
    const r2 = rollD20(); // Always roll twice for possible adv/disadv
    setPopupHtml({
      type: 'd20',
      rollType: type,
      name,
      rolls: [r1, r2],
      bonus
    });
  };

  const rollAbilityCheck = (name, bonus) => {
    triggerD20Roll(name, bonus, 'check');
  };

  const rollSavingThrow = (name, saveBonus) => {
    triggerD20Roll(name, saveBonus, 'save');
  };

  const rollSkillCheck = (name, bonus) => {
    triggerD20Roll(name, bonus, 'skill');
  };

  const rollInitiative = (initBonus) => {
    triggerD20Roll('Initiative', initBonus, 'initiative');
  };

  const rollAttack = (name, hitBonus) => {
    triggerD20Roll(name, hitBonus, 'attack');
  };

  const rollDamage = (name, formula, total, rolls, modifier) => {
    setPopupHtml({
      type: 'damage',
      name,
      formula,
      rolls,
      bonus: 0, // Base bonus is’ 0 because modifier is separate
      modifier
    });
  };

  return {
    popupHtml,
    setPopupHtml,
    rollAbilityCheck,
    rollSavingThrow,
    rollSkillCheck,
    rollInitiative,
    rollAttack,
    rollDamage,
  };
}

