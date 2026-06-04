import React, { useState, useMemo, useCallback } from 'react';
import { getDistanceFeet, rangeToFeet } from '../../services/rangeValidation.js';
import { sendSavePrompt, sendSaveResult } from '../../services/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { addTurnExpiration } from '../../services/turnExpirations.js';
import { addEntry } from '../../services/logService.js';
import { rollD20 } from '../../services/diceRoller.js';
import utils from '../../services/utils.js';
import storage from '../../services/storage.js';

function AbjureFoesModal({ combatSummary, attackerName, attackerPos, maxTargets, saveDc, campaignName, mapData, onClose }) {
    const [selected, setSelected] = useState(new Set());
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState([]);
    const [pendingPrompts, setPendingPrompts] = useState([]);

    const rangeFeet = useMemo(() => rangeToFeet('60 ft') || 60, []);

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
             } else if (next.size < maxTargets) {
                next.add(name);
             }
            return next;
         });
     }, [maxTargets]);

    const addConditionToCreature = useCallback((targetName, saveDcValue) => {
        const creature = combatSummary.creatures.find(c => c.name === targetName);
        if (!creature) return;

        if (creature.type === 'player') {
            const conditions = getRuntimeValue(creature.name, 'activeConditions') || [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'frightened');
            setRuntimeValue(creature.name, 'activeConditions', [...filtered, 'frightened'], campaignName);
         } else {
            creature.conditions = (creature.conditions || []).filter(c => c.key !== 'frightened');
            creature.conditions.push({
                id: utils.guid(),
                key: 'frightened',
                label: 'Frightened',
                dc: saveDcValue,
                ability: 'wis',
             });
         }

        addTurnExpiration(attackerName, targetName, [
          { type: 'frightened', condition: 'frightened' },
         ], campaignName);

     }, [combatSummary, attackerName, campaignName]);

    const logCondition = useCallback((targetName, saveDcValue) => {
        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Frightened',
                dc: saveDcValue,
                ability: 'WIS',
                sourceName: attackerName,
                timestamp: Date.now(),
             }),
         }).catch(() => {});
     }, [campaignName, attackerName]);

    const handleConfirm = useCallback(() => {
        if (selected.size === 0) return;
        setProcessing(true);

        const npcResults = [];
        const playerPrompts = [];

        selected.forEach(targetName => {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            const isNpc = !target || target.type === 'npc';

            if (isNpc) {
                const saveBonus = target?.saveBonuses?.['wis'] ?? 0;
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
                    name: 'Abjure Foes',
                    characterName: attackerName,
                    rollType: 'save-damage',
                    targetName,
                    saveDc,
                    saveType: 'WIS',
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
                    saveType: 'WIS',
                    saveDc,
                    sourceName: attackerName,
                 });
                playerPrompts.push({ promptId, targetName });

                addEntry(campaignName, {
                    type: 'roll',
                    name: 'Abjure Foes',
                    characterName: attackerName,
                    rollType: 'save-damage',
                    targetName,
                    saveDc,
                    saveType: 'WIS',
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

     }, [selected, combatSummary, campaignName, saveDc, attackerName, addConditionToCreature, logCondition]);

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
            name: 'Abjure Foes',
            characterName: attackerName,
            rollType: 'save-damage',
            targetName,
            saveDc,
            saveType: 'WIS',
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

     }, [pendingPrompts, campaignName, attackerName, saveDc, combatSummary, addConditionToCreature, logCondition]);

    React.useEffect(() => {
        if (!processing) return;
        window.addEventListener('save-result', handleSaveResult);
        return () => window.removeEventListener('save-result', handleSaveResult);
     }, [processing, handleSaveResult]);

    const allResolved = processing && pendingPrompts.length === 0 && results.length >= selected.size;

    return (
         <div className="sp-overlay" onClick={onClose}>
             <div className="sp-modal" onClick={e => e.stopPropagation()}>
                 <div className="sp-header">
                     <i className="fa-solid fa-shield-halved"></i> Abjure Foes
                 </div>
                 <div className="sp-body">
                     {!processing ? (
                         <>
                             <p>Select up to <strong>{maxTargets}</strong> target{maxTargets > 1 ? 's' : ''} within 60 feet. Each must make a <strong>WIS</strong> saving throw (DC {saveDc}) or become <strong>Frightened</strong> for 1 minute.</p>
                             <p className="sp-note">Targets selected: {selected.size}/{maxTargets}</p>
                             <div className="abjure-targets-list">
                                 {eligibleTargets.map(c => (
                                     <label key={c.name} className={`abjure-target-row ${selected.has(c.name) ? 'abjure-target-selected' : ''}`}>
                                         <input
                                            type="checkbox"
                                            checked={selected.has(c.name)}
                                            onChange={() => toggleTarget(c.name)}
                                            disabled={!selected.has(c.name) && selected.size >= maxTargets}
                                         />
                                         <span className="abjure-target-name">{c.name}</span>
                                         <span className="abjure-target-type">({c.type})</span>
                                     </label>
                                 ))}
                                 {eligibleTargets.length === 0 && (
                                     <p className="sp-note">No valid targets in range.</p>
                                 )}
                             </div>
                         </>
                     ) : (
                         <>
                             <p>Resolving Wisdom saving throws (DC {saveDc})...</p>
                             <div className="abjure-results-list">
                                 {results.map(r => (
                                     <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                                         <strong>{r.targetName}</strong>: {r.success ? 'Saved — unaffected' : 'Failed — Frightened!'}{typeof r.roll === 'number' && <> (Roll: {r.roll}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = {r.total})</>}
                                     </div>
                                 ))}
                                 {pendingPrompts.map(p => (
                                     <div key={p.promptId} className="abjure-result abjure-result-pending">
                                         <strong>{p.targetName}</strong>: <em>Waiting for save roll...</em>
                                     </div>
                                 ))}
                             </div>
                             {allResolved && (
                                 <p className="sp-note" style={{ marginTop: '8px' }}>All targets resolved. Click to dismiss.</p>
                             )}
                         </>
                     )}
                 </div>
                 <div className="sp-actions">
                     {!processing ? (
                         <>
                             <button className="sp-roll-btn" onClick={handleConfirm} disabled={selected.size === 0} type="button">
                                 <i className="fa-solid fa-dice-d20"></i> Abjure ({selected.size} target{selected.size !== 1 ? 's' : ''})
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

export default AbjureFoesModal;
