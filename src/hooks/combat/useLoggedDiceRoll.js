import { useRef, useEffect } from 'react';
import useDiceRoll from './useDiceRoll.js';
import { SHOW_DICE_ROLL_DELAY } from '../../config/ui-config.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { createSaves } from './useLoggedDiceRollSaves.js';
import { setupEventListeners } from './useLoggedDiceRollEventHandlers.js';
import { useDiceRollPopup } from './DiceRollContext.js';

export default function useLoggedDiceRoll(characterName, campaignName, options = {}) {
  const { popupHtml: contextPopupHtml, setPopupHtml: contextSetPopupHtml, _isShared } = useDiceRollPopup();
  const { popupHtml: internalPopupHtml, setPopupHtml: internalSetPopupHtml } = useDiceRoll();
  const setPopupHtml = _isShared ? contextSetPopupHtml : internalSetPopupHtml;
  const activePopupHtml = _isShared ? contextPopupHtml : internalPopupHtml;
  const { autoDamageRoll, characters, autoDamageSource } = options;
  const autoDamageRollRef = useRef(null);
  autoDamageRollRef.current = autoDamageRoll || null;
  const autoDamageSourceRef = useRef(autoDamageSource || null);
  autoDamageSourceRef.current = autoDamageSource || null;
  const charactersRef = useRef(characters);
  charactersRef.current = characters || [];

  if (!window.__pendingSaves) window.__pendingSaves = {};
  const pendingSaves = window.__pendingSaves;

  function logEntry(entry) {
    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch((e) => { console.error("[useLoggedDiceRoll] Error:", e); });
  }

  setupEventListeners({
    characterName, campaignName, logEntry, charactersRef,
  });

  useEffect(() => {
    if (activePopupHtml?.hit === true && activePopupHtml?.autoDamage && autoDamageRollRef.current) {
      if (activePopupHtml.autoDamage.source !== autoDamageSourceRef.current) return;
      const timer = setTimeout(() => {
        const { autoDamage } = activePopupHtml;
        autoDamageRollRef.current(autoDamage, activePopupHtml.isCrit);
      }, SHOW_DICE_ROLL_DELAY);
      return () => clearTimeout(timer);
    }
  }, [activePopupHtml]);

  const logAndShow = createLogAndShow({
    characterName, campaignName, characters, setPopupHtml, logEntry, autoDamageSourceRef,
  });

  const logDamageAndShow = createLogDamageAndShow({
    characterName, campaignName, characters, setPopupHtml, logEntry, pendingSaves, charactersRef,
  });

  const { quickRollPlayerSave, triggerGloriousDefenseCounterAttack } = createSaves({
    characterName, campaignName, setPopupHtml, logEntry, logAndShow, pendingSaves, charactersRef,
  });

  return {
    popupHtml: internalPopupHtml,
    setPopupHtml,
    rollAbilityCheck: (name, bonus, context) => logAndShow(name, bonus, 'check', context),
    rollSavingThrow: (name, saveBonus, context) => logAndShow(name, saveBonus, 'save', context),
    rollSkillCheck: (name, bonus, context) => logAndShow(name, bonus, 'skill', context),
    rollInitiative: (initBonus, context) => logAndShow('Initiative', initBonus, 'initiative', context),
    rollAttack: (name, hitBonus, context) => logAndShow(name, hitBonus, 'attack', context),
    rollDamage: (name, formula, total, rolls, modifier, context) => logDamageAndShow(name, formula, total, rolls, modifier, context),
    quickRollPlayerSave,
    triggerGloriousDefenseCounterAttack,
  };
}
