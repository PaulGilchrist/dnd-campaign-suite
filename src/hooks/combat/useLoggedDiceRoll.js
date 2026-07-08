import { useRef, useEffect } from 'react';
import useDiceRoll from './useDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { createSaves } from './useLoggedDiceRollSaves.js';
import { setupEventListeners } from './useLoggedDiceRollEventHandlers.js';
import { useDiceRollPopup } from './DiceRollContext.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';

export default function useLoggedDiceRoll(characterName, campaignName, options = {}) {
  const { setPopupHtml: contextSetPopupHtml, _isShared } = useDiceRollPopup();
  const { popupHtml: internalPopupHtml, setPopupHtml: internalSetPopupHtml } = useDiceRoll();
  const setPopupHtml = _isShared ? contextSetPopupHtml : internalSetPopupHtml;
  const { autoDamageRoll, characters, autoDamageSource } = options;
  // eslint-disable-next-line server-first/no-local-game-state
  const autoDamageRollRef = useRef(null);
  autoDamageRollRef.current = autoDamageRoll || null;
  // eslint-disable-next-line server-first/no-local-game-state
  const autoDamageSourceRef = useRef(autoDamageSource || null);
  autoDamageSourceRef.current = autoDamageSource || null;
  const charactersRef = useRef(characters);
  charactersRef.current = characters || [];

  const pendingSaves = getRuntimeValue(campaignName, 'pendingSavePrompts') || {};

  function logEntry(entry) {
    addEntry(campaignName, entry).catch((e) => { console.error("[useLoggedDiceRoll] Error:", e); });
  }

  setupEventListeners({
    characterName, campaignName, logEntry, charactersRef,
  });

  useEffect(() => {
    const handler = (e) => {
      if (autoDamageRollRef.current && e.detail?.autoDamage) {
        if (e.detail.autoDamage.source !== autoDamageSourceRef.current) return;
        if (e.detail.hit === false) return;
        autoDamageRollRef.current(e.detail.autoDamage, e.detail.isCrit);
      }
    };
    window.addEventListener('dice-roll-done', handler);
    return () => window.removeEventListener('dice-roll-done', handler);
  }, [characterName]);

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
