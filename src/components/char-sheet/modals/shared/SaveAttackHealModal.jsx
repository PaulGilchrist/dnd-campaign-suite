import React, { useState, useMemo, useCallback } from 'react';
import { getDistanceFeet } from '../../../../services/rules/combat/rangeValidation.js';
import { sendSavePrompt, sendSaveResult } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { rollExpression } from '../../../../services/dice/diceRoller.js';
import utils from '../../../../services/ui/utils.js';
import storage from '../../../../services/ui/storage.js';
import { applyHealingDirectly, logHealingToSSE } from '../../../../services/automation/common/healingRoll.js';

function SaveAttackHealModal({ combatSummary, attackerName, attackerPos, saveDc, campaignName, mapData, featureName, saveType, rangeFeet, damageExpression, damageType, healExpression, onClose }) {
    const [selected, setSelected] = useState(new Set());
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState([]);
    const [pendingPrompts, setPendingPrompts] = useState([]);
    const [healedTarget, setHealedTarget] = useState(null);
    const [healResult, setHealResult] = useState(null);

    const eligibleTargets = useMemo(() => {
        if (!combatSummary?.creatures) return [];
        return combatSummary.creatures.filter(c => {
            if (c.name === attackerName) return false;
            if (!mapData || !attackerPos) return true;
            const targetPos = mapData.players?.find(p => p.name === c.name) || mapData.placedItems?.find(i => i.name === c.name);
            if (!targetPos) return true;
            const dist = getDistanceFeet(attackerPos, { gridX: targetPos.gridX, gridY: targetPos.gridY });
            return dist != null && dist <= rangeFeet;
         });
      }, [combatSummary, attackerName, mapData, attackerPos, rangeFeet]);

    const toggleTarget = useCallback((name) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
             } else {
                next.add(name);
             }
            return next;
          });
      }, []);

    const handleApply = useCallback(() => {
        if (selected.size === 0) return;
        setProcessing(true);

        const npcResults = [];
        const playerPrompts = [];

        selected.forEach(targetName => {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            const isNpc = !target || target.type === 'npc';

            if (isNpc) {
                const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;
                const roll1 = rollExpression('1d20');
                const total = roll1?.total ?? roll1;
                const success = total >= saveDc;

                sendSaveResult(campaignName, targetName, {
                    promptId: utils.guid(),
                    success,
                    roll: roll1?.total ?? roll1,
                    total,
                    saveBonus,
                    rawRolls: [roll1?.total ?? roll1, roll1?.total ?? roll1],
                 });

                npcResults.push({ targetName, success, roll: roll1?.total ?? roll1, total, saveBonus });

                addEntry(campaignName, {
                    type: 'roll',
                    name: featureName,
                    characterName: attackerName,
                    rollType: 'save-damage',
                    targetName,
                    saveDc,
                    saveType,
                    saveResult: success ? 'success' : 'failure',
                    total,
                    rolls: [roll1?.total ?? roll1],
                    bonus: saveBonus,
                    formula: `1d20${saveBonus !== 0 ? '+' + saveBonus : ''}`,
                    timestamp: Date.now(),
                 }).catch((e) => { console.error("[SaveAttackHealModal] Error:", e); throw e; });

             } else {
                const promptId = utils.guid();
                sendSavePrompt(campaignName, {
                    promptId,
                    targetName,
                    saveType,
                    saveDc,
                    sourceName: attackerName,
                 });
                playerPrompts.push({ promptId, targetName });

                addEntry(campaignName, {
                    type: 'roll',
                    name: featureName,
                    characterName: attackerName,
                    rollType: 'save-damage',
                    targetName,
                    saveDc,
                    saveType,
                    total: 0,
                    rolls: [],
                    bonus: 0,
                    formula: `1d20 (waiting)`,
                    timestamp: Date.now(),
                 }).catch((e) => { console.error("[SaveAttackHealModal] Error:", e); throw e; });
             }
         });

        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        setResults(npcResults);
        setPendingPrompts(playerPrompts);

      }, [selected, combatSummary, campaignName, saveDc, attackerName, featureName, saveType]);

    const handleSaveResult = useCallback((event) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const pendingTarget = pendingPrompts[pendingIndex];
        const targetName = pendingTarget.targetName;
        const success = detail.success;

        addEntry(campaignName, {
            type: 'roll',
            name: featureName,
            characterName: attackerName,
            rollType: 'save-damage',
            targetName,
            saveDc,
            saveType,
            saveResult: success ? 'success' : 'failure',
            total: detail.total ?? 0,
            rolls: [detail.roll ?? 0],
            bonus: detail.saveBonus ?? 0,
            formula: `1d20${detail.saveBonus !== 0 ? '+' + detail.saveBonus : ''}`,
            timestamp: Date.now(),
         }).catch((e) => { console.error("[SaveAttackHealModal] Error:", e); throw e; });

        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        setResults(prev => [...prev, { targetName, success, roll: detail.roll ?? 0, total: detail.total ?? 0, saveBonus: detail.saveBonus ?? 0 }]);
        setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));

      }, [pendingPrompts, campaignName, attackerName, saveDc, combatSummary, featureName, saveType]);

    React.useEffect(() => {
        if (!processing) return;
        window.addEventListener('save-result', handleSaveResult);
        return () => window.removeEventListener('save-result', handleSaveResult);
     }, [processing, handleSaveResult]);

    const allResolved = processing && pendingPrompts.length === 0 && results.length >= selected.size;

    const handleHeal = useCallback(() => {
        if (!healedTarget) return;
        setProcessing(true);

        const rollResult = rollExpression(healExpression);
        if (!rollResult) {
            setProcessing(false);
            return;
        }

        const healAmount = rollResult.total;
        const { newHp, maxHp, actualHeal } = applyHealingDirectly(
            { name: healedTarget, hitPoints: 0 },
            healedTarget,
            healAmount,
            campaignName
        );

        logHealingToSSE(campaignName, {
            targetName: healedTarget,
            sourceName: featureName,
            actualHeal,
            newHp,
            maxHp,
        });

        setHealResult({
            targetName: healedTarget,
            healAmount,
            actualHeal,
            newHp,
            maxHp,
            formula: healExpression,
        });

        addEntry(campaignName, {
            type: 'roll',
            name: featureName,
            characterName: attackerName,
            rollType: 'healing',
            targetName: healedTarget,
            formula: healExpression,
            total: healAmount,
            rolls: rollResult.rolls,
            bonus: 0,
            timestamp: Date.now(),
         }).catch((e) => { console.error("[SaveAttackHealModal] Error:", e); throw e; });

        setProcessing(false);
      }, [healedTarget, healExpression, campaignName, attackerName, featureName]);

    return (
         <div className="sp-overlay" onClick={onClose}>
             <div className="sp-modal" onClick={e => e.stopPropagation()}>
                 <div className="sp-header">
                     <i className="fa-solid fa-dice-d20"></i> {featureName}
                 </div>
                 <div className="sp-body">
                     {!processing && !allResolved ? (
                         <>
                             <p>Select creatures within {rangeFeet} feet. Each must make a <strong>{saveType}</strong> saving throw (DC {saveDc}).</p>
                             <p className="sp-note">On a failed save, target takes {damageExpression} {damageType} damage. On a successful save, target takes half damage.</p>
                             <p className="sp-note">After resolving saves, select one creature to heal for {healExpression} HP.</p>
                             <p className="sp-note">Targets selected: {selected.size}/{eligibleTargets.length}</p>
                             <div className="abjure-targets-list">
                                 {eligibleTargets.map(c => (
                                     <label key={c.name} className={`abjure-target-row ${selected.has(c.name) ? 'abjure-target-selected' : ''}`}>
                                         <input
                                             type="checkbox"
                                             checked={selected.has(c.name)}
                                             onChange={() => toggleTarget(c.name)}
                                         />
                                         <span className="abjure-target-name">{c.name}</span>
                                         <span className="abjure-target-type">({c.type})</span>&nbsp;&nbsp;
                                     </label>
                                 ))}
                                 {eligibleTargets.length === 0 && (
                                     <p className="sp-note">No valid targets in range.</p>
                                 )}
                             </div>
                         </>
                     ) : (
                         <>
                             <p>Resolving {saveType} saving throws (DC {saveDc})...</p>
                             <div className="abjure-results-list">
                                 {results.map(r => (
                                     <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                                         <strong>{r.targetName}</strong>: {r.success ? 'Saved' : `Failed — takes ${damageExpression} ${damageType} damage!`}{typeof r.roll === 'number' && <> (Roll: {r.roll}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = {r.total})</>}
                                     </div>
                                 ))}
                                 {pendingPrompts.map(p => (
                                     <div key={p.promptId} className="abjure-result abjure-result-pending">
                                         <strong>{p.targetName}</strong>: <em>Waiting for save roll...</em>
                                     </div>
                                 ))}
                             </div>
                             {allResolved && (
                                 <>
                                     <p className="sp-note" style={{ marginTop: '8px' }}>All targets resolved.</p>
                                     <p>Select one creature to heal for {healExpression} HP:</p>
                                     <div className="abjure-targets-list">
                                         {results.map(r => (
                                             <label key={r.targetName} className={`abjure-target-row ${healedTarget === r.targetName ? 'abjure-target-selected' : ''}`}>
                                                 <input
                                                     type="radio"
                                                     name="healTarget"
                                                     checked={healedTarget === r.targetName}
                                                     onChange={() => setHealedTarget(r.targetName)}
                                                 />
                                                 <span className="abjure-target-name">{r.targetName}</span>
                                             </label>
                                         ))}
                                     </div>
                                     {healResult && (
                                         <div className="abjure-result abjure-result-success" style={{ marginTop: '8px' }}>
                                             <strong>{healResult.targetName}</strong> healed for <strong>{healResult.healAmount}</strong> HP (actual: {healResult.actualHeal}). Current HP: {healResult.newHp} / {healResult.maxHp}.
                                         </div>
                                     )}
                                 </>
                             )}
                         </>
                     )}
                 </div>
                 <div className="sp-actions">
                     {!processing && !allResolved ? (
                         <>
                             <button className="sp-roll-btn" onClick={handleApply} disabled={selected.size === 0} type="button">
                                 <i className="fa-solid fa-dice-d20"></i> {featureName} ({selected.size} target{selected.size !== 1 ? 's' : ''})
                             </button>
                             <button className="sp-dismiss-btn" onClick={onClose} type="button">
                                 Cancel
                             </button>
                         </>
                     ) : allResolved ? (
                         <>
                             {healResult ? (
                                 <button className="sp-roll-btn" onClick={onClose} type="button">Done</button>
                             ) : (
                                 <button className="sp-roll-btn" onClick={handleHeal} disabled={!healedTarget} type="button">
                                     <i className="fa-solid fa-heart"></i> Heal Selected ({healExpression})
                                 </button>
                             )}
                             <button className="sp-dismiss-btn" onClick={onClose} type="button">
                                 Cancel
                             </button>
                         </>
                     ) : null}
                 </div>
             </div>
         </div>
     );
}

export default SaveAttackHealModal;
