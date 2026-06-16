import React, { useState, useMemo, useCallback } from 'react';
import './EyebiteEffectModal.css';
import { getDistanceFeet } from '../../../services/rules/combat/rangeValidation.js';
import { sendSavePrompt, sendSaveResult } from '../../../services/combat/conditions/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { addEntry } from '../../../services/ui/logService.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { playerIsImmuneToCondition } from '../../../services/combat/automation/automationService.js';
import utils from '../../../services/ui/utils.js';
import storage from '../../../services/ui/storage.js';
import { getEffectOptions } from '../../../services/automation/handlers/spells/eyebiteHandler.js';

function EyebiteEffectModal({ combatSummary, attackerName, attackerPos, saveDc, campaignName, mapData, onClose, characters, featureName = 'Eyebite', rangeFeet = 60, durationRounds = 10 }) {
    const [selectedEffect, setSelectedEffect] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState([]);
    const [pendingPrompts, setPendingPrompts] = useState([]);

    const effectOptions = getEffectOptions();

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

    const applyConditionToCreature = useCallback((targetName, saveDcValue, condKey) => {
        const creature = combatSummary.creatures.find(c => c.name === targetName);
        if (!creature) return;

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
                label: condKey.charAt(0).toUpperCase() + condKey.slice(1),
                dc: saveDcValue,
                ability: 'wis',
            });
        }
    }, [combatSummary, campaignName, characters]);

    const addConditionToCreature = useCallback((targetName, saveDcValue, effect) => {
        applyConditionToCreature(targetName, saveDcValue, effect.condition);

        addExpiration(attackerName, targetName, [
            { type: effect.condition, condition: effect.condition },
        ], campaignName, durationRounds);
    }, [attackerName, campaignName, durationRounds, applyConditionToCreature]);

    const handleSelectEffect = useCallback((effect) => {
        setSelectedEffect(effect);
    }, []);

    const handleApply = useCallback(() => {
        if (!selectedEffect || selected.size === 0) return;
        setProcessing(true);

        const npcResults = [];
        const playerPrompts = [];

        selected.forEach(targetName => {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            const isNpc = !target || target.type === 'npc';

            if (isNpc) {
                const saveBonus = target?.saveBonuses?.wis ?? 0;
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
                    addConditionToCreature(targetName, saveDc, selectedEffect);
                }

                npcResults.push({ targetName, success, roll: roll1, total, saveBonus });

                addEntry(campaignName, {
                    type: 'roll',
                    name: featureName,
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
                    name: featureName,
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

        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        setResults(npcResults);
        setPendingPrompts(playerPrompts);

    }, [selectedEffect, selected, combatSummary, campaignName, saveDc, attackerName, addConditionToCreature, featureName]);

    const handleSaveResult = useCallback((event) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const pendingTarget = pendingPrompts[pendingIndex];
        const targetName = pendingTarget.targetName;
        const success = detail.success;

        if (!success) {
            addConditionToCreature(targetName, saveDc, selectedEffect);
        }

        addEntry(campaignName, {
            type: 'roll',
            name: featureName,
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

        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));

        setResults(prev => [...prev, { targetName, success, roll: detail.roll ?? 0, total: detail.total ?? 0, saveBonus: detail.saveBonus ?? 0 }]);
        setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));

    }, [pendingPrompts, campaignName, attackerName, saveDc, combatSummary, addConditionToCreature, featureName, selectedEffect]);

    React.useEffect(() => {
        if (!processing) return;
        window.addEventListener('save-result', handleSaveResult);
        return () => window.removeEventListener('save-result', handleSaveResult);
    }, [processing, handleSaveResult]);

    const allResolved = processing && pendingPrompts.length === 0 && results.length >= selected.size;

    const effectLabel = selectedEffect ? selectedEffect.label : '';

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-eye"></i> {featureName}
                </div>
                <div className="sp-body">
                    {!selectedEffect ? (
                        <>
                            <p>Choose an effect for the target(s):</p>
                            <div className="eyebite-effects-list">
                                {effectOptions.map(effect => (
                                    <button
                                        key={effect.key}
                                        className={`eyebite-effect-btn ${selectedEffect?.key === effect.key ? 'eyebite-effect-selected' : ''}`}
                                        onClick={() => handleSelectEffect(effect)}
                                        type="button"
                                    >
                                        <strong>{effect.label}</strong>
                                        <span className="eyebite-effect-desc">
                                            {effect.key === 'asleep' && 'Target falls unconscious'}
                                            {effect.key === 'panicked' && 'Target is frightened (must Dash away)'}
                                            {effect.key === 'sickened' && 'Target has disadvantage on attack rolls and ability checks'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : !processing ? (
                        <>
                            <p>Effect: <strong>{effectLabel}</strong>. Select creatures within {rangeFeet} feet. Each must make a <strong>WIS</strong> saving throw (DC {saveDc}) or be affected.</p>
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
                            <p>Resolving WIS saving throws (DC {saveDc}) for <strong>{effectLabel}</strong>...</p>
                            <div className="abjure-results-list">
                                {results.map(r => (
                                    <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                                        <strong>{r.targetName}</strong>: {r.success ? 'Saved — unaffected' : `Failed — ${effectLabel}!`}{typeof r.roll === 'number' && <> (Roll: {r.roll}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = {r.total})</>}
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
                            {!selectedEffect ? (
                                <button className="sp-dismiss-btn" onClick={onClose} type="button">
                                    Cancel
                                </button>
                            ) : (
                                <>
                                    <button className="sp-roll-btn" onClick={handleApply} disabled={selected.size === 0} type="button">
                                        <i className="fa-solid fa-dice-d20"></i> {featureName} ({selected.size} target{selected.size !== 1 ? 's' : ''})
                                    </button>
                                    <button className="sp-dismiss-btn" onClick={() => setSelectedEffect(null)} type="button">
                                        Back
                                    </button>
                                    <button className="sp-dismiss-btn" onClick={onClose} type="button">
                                        Cancel
                                    </button>
                                </>
                            )}
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

export default EyebiteEffectModal;
