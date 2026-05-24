import usePopup from './usePopup.js'
import { rollD20 } from '../services/diceRoller.js'
import './useDiceRoll.css'

function buildAbilityCheckHtml(name, bonus) {
  const roll = rollD20();
  const total = roll + bonus;
  return `<div class="dice-roll-result">`
    + `<div class="dice-roll-header"><i class="fa-solid fa-dice-d20"></i>${name} Check</div>`
    + `<div class="dice-roll-total">${total}</div>`
    + `<div class="dice-roll-breakdown">d20 <span class="dice-rolled">${roll}</span> ${bonus >= 0 ? '+' : ''}${bonus}</div>`
    + `<div class="dice-roll-hint">click to dismiss</div>`
    + `</div>`;
}

function buildSavingThrowHtml(name, saveBonus) {
  const roll = rollD20();
  const total = roll + saveBonus;
  return `<div class="dice-roll-result">`
    + `<div class="dice-roll-header"><i class="fa-solid fa-shield-halved"></i>${name} Saving Throw</div>`
    + `<div class="dice-roll-total">${total}</div>`
    + `<div class="dice-roll-breakdown">d20 <span class="dice-rolled">${roll}</span> ${saveBonus >= 0 ? '+' : ''}${saveBonus}</div>`
    + `<div class="dice-roll-hint">click to dismiss</div>`
    + `</div>`;
}

function buildSkillCheckHtml(name, bonus) {
  const roll = rollD20();
  const total = roll + bonus;
  return `<div class="dice-roll-result">`
    + `<div class="dice-roll-header"><i class="fa-solid fa-dice-d20"></i>${name}</div>`
    + `<div class="dice-roll-total">${total}</div>`
    + `<div class="dice-roll-breakdown">d20 <span class="dice-rolled">${roll}</span> ${bonus >= 0 ? '+' : ''}${bonus}</div>`
    + `<div class="dice-roll-hint">click to dismiss</div>`
    + `</div>`;
}

function buildInitiativeHtml(initBonus) {
  const roll = rollD20();
  const total = roll + initBonus;
  return `<div class="dice-roll-result">`
    + `<div class="dice-roll-header"><i class="fa-solid fa-gavel"></i>Initiative</div>`
    + `<div class="dice-roll-total">${total}</div>`
    + `<div class="dice-roll-breakdown">d20 <span class="dice-rolled">${roll}</span> ${initBonus >= 0 ? '+' : ''}${initBonus}</div>`
    + `<div class="dice-roll-hint">click to dismiss</div>`
    + `</div>`;
}

function buildAttackRollHtml(name, hitBonus) {
  const roll = rollD20();
  const total = roll + hitBonus;
  const isCrit = roll === 20;
  let html = `<div class="dice-roll-result">`
    + `<div class="dice-roll-header"><i class="fa-solid fa-crosshairs"></i>${name}</div>`
    + `<div class="dice-roll-total">${total}</div>`
    + `<div class="dice-roll-breakdown">d20 <span class="dice-rolled">${roll}</span> ${hitBonus >= 0 ? '+' : ''}${hitBonus}</div>`;
  if (isCrit) {
    html += `<div class="dice-roll-crit">Critical Hit!</div>`;
  }
  html += `<div class="dice-roll-hint">click to dismiss</div></div>`;
  return html;
}

function buildDamageRollHtml(name, formula, total, rolls, modifier) {
  let html = `<div class="dice-roll-result">`
    + `<div class="dice-roll-header"><i class="fa-solid fa-bolt"></i>${name}</div>`
    + `<div class="dice-roll-total">${total}</div>`
    + `<div class="dice-roll-breakdown">${formula}: (<span class="dice-rolled">${rolls.join(', ')}</span>)`;
  if (modifier) {
    html += ` ${modifier >= 0 ? '+' : ''}${modifier}`;
  }
  html += `</div>`
    + `<div class="dice-roll-hint">click to dismiss</div></div>`;
  return html;
}

export default function useDiceRoll() {
  const { popupHtml, setPopupHtml } = usePopup(() => null);

  const rollAbilityCheck = (name, bonus) => {
    setPopupHtml(buildAbilityCheckHtml(name, bonus));
  };

  const rollSavingThrow = (name, saveBonus) => {
    setPopupHtml(buildSavingThrowHtml(name, saveBonus));
  };

  const rollSkillCheck = (name, bonus) => {
    setPopupHtml(buildSkillCheckHtml(name, bonus));
  };

  const rollInitiative = (initBonus) => {
    setPopupHtml(buildInitiativeHtml(initBonus));
  };

  const rollAttack = (name, hitBonus) => {
    setPopupHtml(buildAttackRollHtml(name, hitBonus));
  };

  const rollDamage = (name, formula, total, rolls, modifier) => {
    setPopupHtml(buildDamageRollHtml(name, formula, total, rolls, modifier));
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

export { buildAbilityCheckHtml, buildSavingThrowHtml, buildSkillCheckHtml, buildInitiativeHtml, buildAttackRollHtml, buildDamageRollHtml };
