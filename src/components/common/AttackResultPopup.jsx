import { useCallback, useState, useRef } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../services/ui/logService.js';
import Popup from './popup.jsx';
import DiceRollResult from '../char-sheet/DiceRollResult.jsx';

function resolveInspirationUses(raw) {
  if (typeof raw === 'object' && raw !== null) return raw.current;
  return raw != null ? Number(raw) : 0;
}

function buildBiDefenseDescription({ attackerName, targetName, dieValue, newAc, attackTotal, willMiss }) {
  return willMiss
    ? `${attackerName || 'The attacker'}'s attack missed! ${targetName} used Combat Inspiration - Defense, rolling ${dieValue} to boost AC to ${newAc}. Attack total (${attackTotal}) < new AC (${newAc}).`
    : `${targetName} used Combat Inspiration - Defense, rolling ${dieValue} to boost AC to ${newAc}, but the attack still hits (${attackTotal} >= ${newAc}).`;
}

function DiceRollPopupContent({ popupHtml, playerStats, missToHitApplied, boonUsed, onDone, onStrokeOfLuck, onBardicInspirationDefense, ...callbacks }) {
  return (
    <DiceRollResult
      {...popupHtml}
      hit={missToHitApplied || popupHtml?.hit}
      autoDamage={popupHtml?.autoDamage}
      playerStats={playerStats}
      onBardicInspirationDefense={popupHtml?.bardicInspirationDefense ? onBardicInspirationDefense : undefined}
      onDone={popupHtml?.autoDamage ? onDone : undefined}
      onStrokeOfLuck={popupHtml?.strokeOfLuck || (popupHtml?.autoRerollForAttack && !missToHitApplied && !boonUsed) ? onStrokeOfLuck : undefined}
      {...callbacks}
    />
  );
}

function AttackResultPopup({ popupHtml, onClose, campaignName, attackerName, playerStats, setPopupHtml, onBeforeBiDefense, onAfterBiDefense, onStrokeOfLuck, ...callbacks }) {
  const [missToHitApplied, setMissToHitApplied] = useState(false);
  const hasBoonBeenUsedRef = useRef(false);

  if (popupHtml?.autoRerollForAttack && attackerName) {
    const used = getRuntimeValue(attackerName, 'boonOfCombatProwessUsed');
    hasBoonBeenUsedRef.current = !!used;
  }

  const handleDone = useCallback((computedHit, chosenDamageType) => {
    const actualHit = computedHit !== undefined ? computedHit : (missToHitApplied || popupHtml?.hit);
    if (popupHtml?.autoDamage && actualHit) {
      const autoDamage = chosenDamageType
        ? { ...popupHtml.autoDamage, damageType: chosenDamageType }
        : popupHtml.autoDamage;
      window.dispatchEvent(new CustomEvent('dice-roll-done', {
        detail: { autoDamage, isCrit: popupHtml.isCrit, hit: true },
      }));
    }
    if (onClose) onClose();
  }, [popupHtml, onClose, missToHitApplied]);

  const handleMissToHit = useCallback((featureKey) => {
    if (!popupHtml || missToHitApplied || (featureKey === 'boonOfCombatProwess' && hasBoonBeenUsedRef.current)) return;
    setMissToHitApplied(true);
    if (onStrokeOfLuck) onStrokeOfLuck(featureKey);
  }, [popupHtml, missToHitApplied, onStrokeOfLuck]);

  const handleBardicInspirationDefense = useCallback(async (dieValue, dieSize, newAc, willMiss) => {
    if (!popupHtml) return;
    const targetName = popupHtml.bardicInspirationDefenseTargetName;
    if (!targetName) {
      console.error('[BI Defense] AttackResultPopup: No targetName in popupHtml');
      return;
    }
    if (onBeforeBiDefense) {
      await onBeforeBiDefense({ dieValue, dieSize, newAc, willMiss, targetName });
    }
    const currentUses = resolveInspirationUses(getRuntimeValue(targetName, 'bardicInspirationUses', campaignName));
    if (currentUses > 0) {
      await setRuntimeValue(targetName, 'bardicInspirationUses', currentUses - 1, campaignName);
    }
    if (willMiss && setPopupHtml) {
      setPopupHtml({ ...popupHtml, hit: false, isAutoMiss: true });
    }
    const attackTotal = (popupHtml?.rolls?.[0] || 0) + (popupHtml?.bonus || 0);
    try {
      await logService.addEntry(campaignName, {
        type: 'ability_use',
        characterName: targetName,
        abilityName: 'Combat Inspiration - Defense',
        description: buildBiDefenseDescription({ attackerName, targetName, dieValue, newAc, attackTotal, willMiss }),
        biDieRoll: dieValue,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error('[BI Defense] AttackResultPopup: Failed to log entry:', e);
    }
    await setRuntimeValue(targetName, 'bardicInspirationDie', null, campaignName);
    await setRuntimeValue(targetName, 'bardicInspirationCombatOptions', null, campaignName);
    await setRuntimeValue(targetName, 'bardicInspirationGrantedBy', null, campaignName);
    if (onAfterBiDefense) {
      await onAfterBiDefense({ dieValue, dieSize, newAc, willMiss, targetName });
    }
  }, [popupHtml, campaignName, attackerName, setPopupHtml, onBeforeBiDefense, onAfterBiDefense]);

  return (
    <Popup onClickOrKeyDown={onClose}>
      {typeof popupHtml === 'string' ? (
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }} />
      ) : (
        <DiceRollPopupContent
          popupHtml={popupHtml}
          playerStats={playerStats}
          missToHitApplied={missToHitApplied}
          boonUsed={hasBoonBeenUsedRef.current}
          onDone={handleDone}
          onStrokeOfLuck={handleMissToHit}
          onBardicInspirationDefense={handleBardicInspirationDefense}
          {...callbacks}
        />
      )}
    </Popup>
  );
}

export default AttackResultPopup;
