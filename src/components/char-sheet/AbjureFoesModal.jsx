import React, { useState, useMemo, useCallback } from 'react';
import { getDistanceFeet, rangeToFeet } from '../../services/rangeValidation.js';
import { sendSavePrompt, sendSaveResult } from '../../services/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { addTurnExpiration } from '../../services/turnExpirations.js';
import { addEntry } from '../../services/logService.js';
import { rollD20 } from '../../services/diceRoller.js';
import utils from '../../services/utils.js';

function AbjureFoesModal({ combatSummary, attackerName, attackerPos, maxTargets, saveDc, campaignName, characters: _characters, activeMapName: _activeMapName, mapData, onClose }) {
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

    const handleConfirm = useCallback(() => {
        if (selected.size === 0) return;
        setProcessing(true);

        const prompts = [];
        selected.forEach(targetName => {
            const promptId = utils.guid();
            const target = combatSummary.creatures.find(c => c.name === targetName);
            const isNpc = target?.type === 'npc';

            if (isNpc) {
                const saveBonus = target?.saveBonuses?.['wis'] ?? 0;
                const r1 = rollD20();
                const total = r1 + saveBonus;
                const success = total >= saveDc;

                sendSaveResult(campaignName, targetName, {
                    promptId,
                    success,
                    roll: r1,
                    total,
                    saveBonus,
                    rawRolls: [r1, r1],
                });

                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: {
                        promptId,
                        targetName,
                        saveType: 'WIS',
                        saveDc,
                        success,
                        roll: r1,
                        total,
                        saveBonus,
                        rawRolls: [r1, r1],
                    },
                }));
            } else {
                sendSavePrompt(campaignName, {
                    promptId,
                    targetName,
                    saveType: 'WIS',
                    saveDc,
                    sourceName: attackerName,
                });
            }

            prompts.push({ promptId, targetName, isNpc });
        });

        setPendingPrompts(prompts);
    }, [selected, combatSummary, campaignName, saveDc, attackerName]);

    const handleSaveResult = useCallback(async (event) => {
        const detail = event.detail;
        const pending = pendingPrompts.find(p => p.promptId === detail.promptId);
        if (!pending || pending.isNpc) return;

        const targetName = pending.targetName;
        const creature = combatSummary.creatures.find(c => c.name === targetName);
        if (!creature) return;

        const success = detail.success;

        if (!success) {
            if (creature.type === 'player') {
                const conditions = getRuntimeValue(creature.name, 'activeConditions') || [];
                const filtered = conditions.filter(c => String(c).toLowerCase() !== 'frightened');
                setRuntimeValue(creature.name, 'activeConditions', [...filtered, 'frightened'], campaignName);
            } else {
                creature.conditions = creature.conditions.filter(c => c.key !== 'frightened');
                creature.conditions.push({
                    id: utils.guid(),
                    key: 'frightened',
                    label: 'Frightened',
                    dc: saveDc,
                    ability: 'wis',
                });
            }

            addTurnExpiration(attackerName, targetName, [
                { type: 'frightened', condition: 'frightened' },
            ], campaignName);
        }

        addEntry(campaignName, {
            type: 'save_result',
            characterName: attackerName,
            rollType: 'save-set_condition',
            targetName,
            saveDc,
            saveType: 'WIS',
            success,
            description: `${targetName} ${success ? 'succeeded' : 'failed'} on WIS save vs ${attackerName}'s Abjure Foes.`,
        }).catch(() => {});

        setResults(prev => [...prev, { targetName, success }]);
        setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));
    }, [pendingPrompts, combatSummary, campaignName, saveDc, attackerName]);

    React.useEffect(() => {
        if (!processing) return;
        window.addEventListener('save-result', handleSaveResult);
        return () => window.removeEventListener('save-result', handleSaveResult);
    }, [processing, handleSaveResult]);

    const allResolved = processing && pendingPrompts.filter(p => !p.isNpc).length === 0 && results.length >= selected.size;

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
                                        <strong>{r.targetName}</strong>: {r.success ? 'Saved — unaffected' : 'Failed — Frightened!'}
                                    </div>
                                ))}
                                {pendingPrompts.filter(p => !p.isNpc).map(p => (
                                    <div key={p.promptId} className="abjure-result abjure-result-pending">
                                        <strong>{p.targetName}</strong>: <em>Waiting for player to roll...</em>
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
