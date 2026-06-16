import React, { useState, useMemo, useCallback } from 'react';
import { getDistanceFeet } from '../../../services/rules/combat/rangeValidation.js';
import { sendSavePrompt, sendSaveResult } from '../../../services/combat/conditions/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { addEntry } from '../../../services/ui/logService.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { playerIsImmuneToCondition } from '../../../services/combat/automationService.js';
import utils from '../../../services/ui/utils.js';
import storage from '../../../services/ui/storage.js';

function SetConditionModal({ combatSummary, attackerName, attackerPos, saveDc, campaignName, mapData, onClose, characters, featureName = 'Abjure Foes', conditionName = 'frightened', additionalCondition = null, saveType = 'WIS', rangeFeet = 60, durationRounds }) {
    const [selected, setSelected] = useState(new Set());
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState([]);
    const [pendingPrompts, setPendingPrompts] = useState([]);

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

    const applyConditionToCreature = useCallback((targetName, saveDcValue, condName) => {
        const creature = combatSummary.creatures.find(c => c.name === targetName);
        if (!creature) return;

        const condKey = condName.toLowerCase();

        const targetCharacter = characters?.find(c => utils.getName(c.name) === targetName);
        const targetStats = targetCharacter?.computedStats || targetCharacter;
        if (targetStats && playerIsImmuneToCondition({
            conditionKey: condKey,
            playerStats: targetStats,
            getRuntimeValue,
            campaignName,
        })) {
            return;
        }

        if (creature.type === 'player') {
            const conditions = getRuntimeValue(creature.name, 'activeConditions') || [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
            setRuntimeValue(creature.name, 'activeConditions', [...filtered, condKey], campaignName);
         } else {
            creature.conditions = (creature.conditions || []).filter(c => c.key !== condKey);
            creature.conditions.push({
                id: utils.guid(),
                key: condKey,
                label: condName.charAt(0).toUpperCase() + condName.slice(1),
                dc: saveDcValue,
                ability: saveType.toLowerCase(),
             });
         }
     }, [combatSummary, campaignName, characters, saveType]);

    const addConditionToCreature = useCallback((targetName, saveDcValue) => {
        applyConditionToCreature(targetName, saveDcValue, conditionName);

        if (additionalCondition) {
            applyConditionToCreature(targetName, saveDcValue, additionalCondition);
        }

        addExpiration(attackerName, targetName, [
            { type: conditionName.toLowerCase(), condition: conditionName.toLowerCase() },
            ...(additionalCondition ? [{ type: additionalCondition.toLowerCase(), condition: additionalCondition.toLowerCase() }] : []),
           ], campaignName, durationRounds);

     }, [attackerName, campaignName, conditionName, additionalCondition, durationRounds, applyConditionToCreature]);

    const logCondition = useCallback((targetName, saveDcValue) => {
        const conditions = [conditionName.charAt(0).toUpperCase() + conditionName.slice(1)];
        if (additionalCondition) {
            conditions.push(additionalCondition.charAt(0).toUpperCase() + additionalCondition.slice(1));
        }
        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: conditions.join(' & '),
                dc: saveDcValue,
                ability: saveType,
                sourceName: attackerName,
                timestamp: Date.now(),
             }),
          }).catch(() => {});
     }, [campaignName, attackerName, conditionName, additionalCondition, saveType]);

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
                const roll1 = rollD20();
                const total = roll1 + saveBonus;
                const success = total >= saveDc;

                sendSaveResult(campaignName, targetName, {
                    promptId: utils.guid(),
                    success,
                    roll: roll1,
                    total,
                    saveBonus,
                    rawRolls: [roll1, roll1],
                 });

                if (!success) {
                    addConditionToCreature(targetName, saveDc);
                 }

                npcResults.push({ targetName, success, roll: roll1, total, saveBonus });

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
                    rolls: [roll1],
                    bonus: saveBonus,
                    formula: `1d20${saveBonus !== 0 ? '+' + saveBonus : ''}`,
                    timestamp: Date.now(),
                 }).catch(() => {});

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
                 }).catch(() => {});
             }
         });

        // Persist all mutations once, then notify subscribers
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        // Log condition applications for failed NPC saves
        npcResults.filter(r => !r.success).forEach(r => {
            logCondition(r.targetName, saveDc);
         });

        setResults(npcResults);
        setPendingPrompts(playerPrompts);

     }, [selected, combatSummary, campaignName, saveDc, attackerName, addConditionToCreature, logCondition, featureName, saveType]);

    const handleSaveResult = useCallback((event) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const pendingTarget = pendingPrompts[pendingIndex];
        const targetName = pendingTarget.targetName;
        const success = detail.success;

        if (!success) {
            addConditionToCreature(targetName, saveDc);
            logCondition(targetName, saveDc);
         }

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
         }).catch(() => {});

        // Persist and notify after player save result
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        setResults(prev => [...prev, { targetName, success, roll: detail.roll ?? 0, total: detail.total ?? 0, saveBonus: detail.saveBonus ?? 0 }]);
        setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));

     }, [pendingPrompts, campaignName, attackerName, saveDc, combatSummary, addConditionToCreature, logCondition, featureName, saveType]);

    React.useEffect(() => {
        if (!processing) return;
        window.addEventListener('save-result', handleSaveResult);
        return () => window.removeEventListener('save-result', handleSaveResult);
     }, [processing, handleSaveResult]);

    const allResolved = processing && pendingPrompts.length === 0 && results.length >= selected.size;

    React.useEffect(() => {
        if (allResolved && featureName.toLowerCase().includes('turn undead')) {
            const failedTargets = results.filter(r => !r.success).map(r => r.targetName);
            if (failedTargets.length > 0) {
                window.dispatchEvent(new CustomEvent('turn-undead-result', {
                    detail: {
                        failedTargets,
                        attackerName,
                        saveDc,
                        saveType,
                        campaignName,
                    },
                }));
            }
        }
    }, [allResolved, featureName, results, attackerName, saveDc, saveType, campaignName]);

    const conditionLabel = conditionName.charAt(0).toUpperCase() + conditionName.slice(1)
        + (additionalCondition ? ' & ' + additionalCondition.charAt(0).toUpperCase() + additionalCondition.slice(1) : '');

    return (
         <div className="sp-overlay" onClick={onClose}>
             <div className="sp-modal" onClick={e => e.stopPropagation()}>
                 <div className="sp-header">
                     <i className="fa-solid fa-dice-d20"></i> {featureName}
                 </div>
                 <div className="sp-body">
                     {!processing ? (
                         <>
                             <p>Select creatures within {rangeFeet} feet. Each must make a <strong>{saveType}</strong> saving throw (DC {saveDc}) or become <strong>{conditionLabel}</strong> for 1 minute.</p>
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
                                         <strong>{r.targetName}</strong>: {r.success ? 'Saved — unaffected' : `Failed — ${conditionLabel}!`}{typeof r.roll === 'number' && <> (Roll: {r.roll}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = {r.total})</>}
                                     </div>
                                 ))}
                                 {pendingPrompts.map(p => (
                                     <div key={p.promptId} className="abjure-result abjure-result-pending">
                                         <strong>{p.targetName}</strong>: <em>Waiting for save roll...</em>
                                     </div>
                                 ))}
                             </div>
                             {allResolved && (
                                 <p className="sp-note" style={{ marginTop: '8px' }}>All targets resolved.</p>
                             )}
                         </>
                     )}
                 </div>
                 <div className="sp-actions">
                     {!processing ? (
                         <>
                             <button className="sp-roll-btn" onClick={handleApply} disabled={selected.size === 0} type="button">
                                 <i className="fa-solid fa-dice-d20"></i> {featureName} ({selected.size} target{selected.size !== 1 ? 's' : ''})
                             </button>
                             <button className="sp-dismiss-btn" onClick={onClose} type="button">
                                 Cancel
                             </button>
                         </>
                     ) : allResolved ? (
                         <button className="sp-roll-btn" onClick={onClose} type="button">
                             Done
                         </button>
                     ) : null}
                 </div>
             </div>
         </div>
     );
}

export default SetConditionModal;
