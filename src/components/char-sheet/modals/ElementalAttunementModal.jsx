import React, { useState, useCallback, useEffect } from 'react';
import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { computeDamageAfterSave, computeDamageAfterResistancesWithDetails, applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { getAffectedCreatures } from '../../../services/rules/combat/aoeService.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { addEntry } from '../../../services/ui/logService.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { persistAndNotify } from './shared/AreaEffectTargetModalBase.utils.jsx';
import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

const ELEMENT_DATA = {
    Cold: {
        icon: 'fa-snowflake',
        saveType: 'DEX',
        shape: 'sphere',
        radius: '5 ft',
        effect: 'speed_reduction',
        effectValue: '15',
    },
    Fire: {
        icon: 'fa-fire',
        saveType: 'DEX',
        shape: 'sphere',
        radius: '5 ft',
        damage: '1d10',
        damageType: 'fire',
        dcSuccess: 'half',
    },
    Lightning: {
        icon: 'fa-bolt',
        saveType: 'DEX',
        shape: 'line',
        lineLength: '60 ft',
        damage: '1d8',
        damageType: 'lightning',
        dcSuccess: 'half',
    },
    Thunder: {
        icon: 'fa-volume-high',
        saveType: 'CON',
        shape: 'sphere',
        radius: '5 ft',
        damage: '1d6',
        damageType: 'thunder',
        effect: 'push',
        effectValue: '10',
        dcSuccess: 'half',
    },
};

const ELEMENT_DESCRIPTIONS = {
    Cold: '5-ft radius area of extreme cold. Dexterity save or speed reduced by 15 ft.',
    Fire: '5-ft radius flames. Dexterity save or 1d10 fire damage (half on save).',
    Lightning: '60-ft line of lightning. Dexterity save or 1d8 lightning damage (half on save).',
    Thunder: '5-ft radius burst of sonic energy. Constitution save or 1d6 thunder damage (half on save) and pushed 10 ft.',
};

function ElementalAttunementModal({ action, playerStats, campaignName, mapName, activeOverlay, onClose }) {
    const [phase, setPhase] = useState('element');
    const [chosenElement, setChosenElement] = useState(null);
    const [targets, setTargets] = useState([]);
    const [selectedTargets, setSelectedTargets] = useState(new Set());
    const [results, setResults] = useState([]);
    const [pendingPrompts, setPendingPrompts] = useState([]);

    const elementData = chosenElement ? ELEMENT_DATA[chosenElement] : null;
    const saveType = elementData?.saveType || 'DEX';
    const saveDc = 8 + (playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 0) + playerStats.proficiency;

    useEffect(() => {
        return () => {
            setPhase('element');
            setChosenElement(null);
            setTargets([]);
            setSelectedTargets(new Set());
            setResults([]);
            setPendingPrompts([]);
        };
    }, []);

    useEffect(() => {
        if (pendingPrompts.length === 0 && results.length > 0 && !phase.startsWith('summary')) {
            setPhase('summary');
        }
    }, [pendingPrompts.length, results.length, phase]);

    const handleElementChoice = (element) => {
        setChosenElement(element);
        setPhase('targets');
    };

    const handleCreatureSelectionConfirm = useCallback((selectedNames) => {
        setSelectedTargets(new Set(selectedNames));
        setPhase('processing');
    }, []);

    const handleCreatureSelectionSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    const resolveAllSavesAndDamage = useCallback(async (selectedNames) => {
        const combatSummary = getCombatSummary(campaignName);
        if (!combatSummary) return { results: [], prompts: [] };

        const results = [];
        const prompts = [];
        const characters = combatSummary.creatures.filter(c => c.type === 'player') || [];

        for (const targetName of selectedNames) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            if (!target) continue;

            const isNpc = target.type === 'npc';
            const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;

            if (isNpc) {
                const saveRoll = Math.floor(Math.random() * 20) + 1;
                const saveTotal = saveRoll + saveBonus;
                const success = saveTotal >= saveDc;

                const logEntry = {
                    type: 'roll',
                    characterName: playerStats.name,
                    rollType: 'save-damage',
                    name: action.name,
                    targetName,
                    saveType: saveType.toLowerCase(),
                    saveDc,
                    saveResult: success ? 'success' : 'failure',
                    saveRoll,
                    saveBonus,
                    saveRawRolls: [saveRoll],
                    timestamp: Date.now(),
                };

                if (elementData?.damage) {
                    const damageRoll = rollExpression(elementData.damage);
                    const rawDamage = damageRoll?.total ?? 0;
                    const damageAfterSave = computeDamageAfterSave(rawDamage, success, elementData.dcSuccess);
                    const resResult = computeDamageAfterResistancesWithDetails(
                        damageAfterSave, [elementData.damageType], target.resistances || [], target.immunities || []
                    );
                    const finalDamage = resResult.finalDamage;

                    applyDamageToTarget(
                        combatSummary, targetName, finalDamage, [elementData.damageType],
                        campaignName, characters, false, playerStats.name, false
                    );

                    logEntry.formula = elementData.damage;
                    logEntry.rolls = damageRoll?.rolls ?? [];
                    logEntry.total = rawDamage;
                    logEntry.modifier = damageRoll?.modifier ?? 0;
                    logEntry.damageType = elementData.damageType;
                    logEntry.finalDamage = finalDamage;

                    addEntry(campaignName, logEntry).catch((e) => {
                        console.error('[ElementalAttunementModal] Error logging NPC save:', e);
                    });

                    results.push({
                        targetName,
                        success,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        rawDamage,
                        finalDamage,
                        formula: elementData.damage,
                        rolls: damageRoll?.rolls ?? [],
                        damageType: elementData.damageType,
                    });
                } else if (elementData?.effect === 'speed_reduction') {
                    if (!success) {
                        const activeConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
                        const speedReductionActive = activeConditions.includes('speed_reduction');
                        const newConditions = speedReductionActive
                            ? activeConditions
                            : [...activeConditions, 'speed_reduction'];
                        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
                    }

                    addEntry(campaignName, {
                        type: 'ability_use',
                        characterName: playerStats.name,
                        abilityName: action.name,
                        description: `${action.name} (${chosenElement}) on <strong>${targetName}</strong>: ${success ? 'saved' : 'failed'} ${saveType} save (DC ${saveDc}). ${success ? 'No effect.' : 'Speed reduced by 15 ft.'}`,
                        saveRoll,
                        saveBonus,
                        saveTotal,
                        saveDc,
                        saveSuccess: success,
                    }).catch((e) => { console.error('[ElementalAttunementModal] Error logging speed reduction:', e); });

                    results.push({
                        targetName,
                        success,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        rawDamage: 0,
                        finalDamage: 0,
                        effect: 'speed_reduction',
                    });
                } else if (elementData?.effect === 'push') {
                    const damageRoll = rollExpression(elementData.damage);
                    const rawDamage = damageRoll?.total ?? 0;
                    const damageAfterSave = computeDamageAfterSave(rawDamage, success, elementData.dcSuccess);
                    const resResult = computeDamageAfterResistancesWithDetails(
                        damageAfterSave, [elementData.damageType], target.resistances || [], target.immunities || []
                    );
                    const finalDamage = resResult.finalDamage;

                    applyDamageToTarget(
                        combatSummary, targetName, finalDamage, [elementData.damageType],
                        campaignName, characters, false, playerStats.name, false
                    );

                    if (!success) {
                        const pushDistance = elementData.effectValue;
                        const currentTarget = combatSummary.creatures.find(c => c.name === targetName);
                        if (currentTarget) {
                            const pushEffect = {
                                target: targetName,
                                direction: currentTarget.pushDirection || 'forward',
                                distance: pushDistance,
                                source: playerStats.name,
                                feature: action.name,
                            };
                            const targetEffects = getRuntimeValue(targetName, 'targetEffects', campaignName) || [];
                            const newTargetEffects = [...targetEffects, pushEffect];
                            setRuntimeValue(targetName, 'targetEffects', newTargetEffects, campaignName);
                        }
                    }

                    logEntry.formula = elementData.damage;
                    logEntry.rolls = damageRoll?.rolls ?? [];
                    logEntry.total = rawDamage;
                    logEntry.modifier = damageRoll?.modifier ?? 0;
                    logEntry.damageType = elementData.damageType;
                    logEntry.finalDamage = finalDamage;

                    addEntry(campaignName, logEntry).catch((e) => {
                        console.error('[ElementalAttunementModal] Error logging Thunder save:', e);
                    });

                    results.push({
                        targetName,
                        success,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        rawDamage,
                        finalDamage,
                        formula: elementData.damage,
                        rolls: damageRoll?.rolls ?? [],
                        damageType: elementData.damageType,
                    });
                }
            } else {
                const promptId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

                if (elementData?.damage) {
                    const damageRoll = rollExpression(elementData.damage);
                    const rawDamage = damageRoll?.total ?? 0;

                    sendSavePrompt(campaignName, {
                        promptId,
                        targetName,
                        saveType,
                        saveDc,
                        sourceName: playerStats.name,
                        rawDamage,
                    });

                    prompts.push({ promptId, targetName });
                } else if (elementData?.effect === 'speed_reduction') {
                    sendSavePrompt(campaignName, {
                        promptId,
                        targetName,
                        saveType,
                        saveDc,
                        sourceName: playerStats.name,
                    });

                    prompts.push({ promptId, targetName });
                }
            }
        }

        persistAndNotify(combatSummary, campaignName);
        return { results, prompts };
    }, [campaignName, action.name, playerStats.name, chosenElement, elementData, saveType, saveDc]);

    useEffect(() => {
        if (phase === 'targets') {
            if (activeOverlay) {
                const cs = getCombatSummary(campaignName);
                if (!cs) return;

                let players = [];
                let placedItems = [];

                if (mapName) {
                    try {
                        import('../../../services/maps/mapsService.js').then(mapsService => {
                            mapsService.loadMapData(campaignName, mapName).then(mapData => {
                                if (mapData) {
                                    players = mapData.players || [];
                                    placedItems = (mapData.placedItems || []).filter(item => item.type === 'npc' && item.name);
                                }
                                const affected = getAffectedCreatures(activeOverlay, players, placedItems, cs);
                                const targetList = affected.map(a => ({
                                    name: a.creature.name,
                                    type: a.creature.type,
                                    currentHp: a.creature.currentHp,
                                    maxHp: a.creature.maxHp,
                                }));
                                setTargets(targetList);
                                setSelectedTargets(new Set(targetList.map(t => t.name)));
                                setPhase('processing');
                            });
                        }).catch(e => {
                            console.error('[ElementalAttunementModal] Error loading map data:', e);
                        });
                    } catch (e) {
                        console.error('[ElementalAttunementModal] Error loading map data:', e);
                    }
                } else {
                    const affected = getAffectedCreatures(activeOverlay, players, placedItems, cs);
                    const targetList = affected.map(a => ({
                        name: a.creature.name,
                        type: a.creature.type,
                        currentHp: a.creature.currentHp,
                        maxHp: a.creature.maxHp,
                    }));
                    setTargets(targetList);
                    setSelectedTargets(new Set(targetList.map(t => t.name)));
                    setPhase('processing');
                }
            } else {
                const cs = getCombatSummary(campaignName);
                if (!cs) return;

                const targetList = cs.creatures
                    .filter(c => c.name !== playerStats.name)
                    .map(c => ({
                        name: c.name,
                        type: c.type,
                        currentHp: c.currentHp,
                        maxHp: c.maxHp,
                    }));
                setTargets(targetList);
                setPhase('creatureSelection');
            }
        }
    }, [phase, activeOverlay, campaignName, mapName, playerStats.name]);

    useEffect(() => {
        if (phase === 'processing' && selectedTargets.size > 0) {
            resolveAllSavesAndDamage(Array.from(selectedTargets)).then(({ results: newResults, prompts: newPrompts }) => {
                setResults(newResults);
                setPendingPrompts(newPrompts);
            });
        }
    }, [phase, selectedTargets, resolveAllSavesAndDamage]);

    useEffect(() => {
        if (pendingPrompts.length === 0) return;
        const handleSaveEvent = (event) => {
            const detail = event.detail;
            if (!detail || !detail.promptId) return;

            const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
            if (pendingIndex === -1) return;

            const targetName = pendingPrompts[pendingIndex].targetName;
            const success = detail.success;
            const saveBonus = detail.saveBonus ?? 0;
            const rawDamage = detail.rawDamage ?? 0;

            const combatSummary = getCombatSummary(campaignName);
            if (!combatSummary) return;

            const logEntry = {
                type: 'roll',
                characterName: playerStats.name,
                rollType: 'save-damage',
                name: action.name,
                targetName,
                saveType: saveType.toLowerCase(),
                saveDc,
                saveResult: success ? 'success' : 'failure',
                saveRoll: detail.roll ?? 0,
                saveBonus,
                saveRawRolls: [detail.roll ?? 0],
                timestamp: Date.now(),
            };

            if (elementData?.damage) {
                const damageRoll = rollExpression(elementData.damage);
                const damageAfterSave = computeDamageAfterSave(rawDamage, success, elementData.dcSuccess);
                const resResult = computeDamageAfterResistancesWithDetails(
                    damageAfterSave, [elementData.damageType], (combatSummary.creatures.find(c => c.name === targetName)?.resistances || []), (combatSummary.creatures.find(c => c.name === targetName)?.immunities || [])
                );
                const finalDamage = resResult.finalDamage;

                const characters = combatSummary.creatures.filter(c => c.type === 'player') || [];
                applyDamageToTarget(
                    combatSummary, targetName, finalDamage, [elementData.damageType],
                    campaignName, characters, false, playerStats.name, false
                );

                logEntry.formula = elementData.damage;
                logEntry.rolls = damageRoll?.rolls ?? [];
                logEntry.total = rawDamage;
                logEntry.modifier = damageRoll?.modifier ?? 0;
                logEntry.damageType = elementData.damageType;
                logEntry.finalDamage = finalDamage;

                addEntry(campaignName, logEntry).catch((e) => {
                    console.error('[ElementalAttunementModal] Error logging player save:', e);
                });

                setResults(prev => [...prev, {
                    targetName,
                    success,
                    roll: detail.roll ?? 0,
                    total: detail.total ?? 0,
                    saveBonus,
                    rawDamage,
                    finalDamage,
                    formula: elementData.damage,
                    rolls: damageRoll?.rolls ?? [],
                    damageType: elementData.damageType,
                }]);
            } else {
                if (!success && elementData?.effect === 'speed_reduction') {
                    const activeConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
                    const speedReductionActive = activeConditions.includes('speed_reduction');
                    const newConditions = speedReductionActive
                        ? activeConditions
                        : [...activeConditions, 'speed_reduction'];
                    setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
                }

                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerStats.name,
                    abilityName: action.name,
                    description: `${action.name} (${chosenElement}) on <strong>${targetName}</strong>: ${success ? 'saved' : 'failed'} ${saveType} save (DC ${saveDc}). ${success ? 'No effect.' : 'Speed reduced by 15 ft.'}`,
                    saveRoll: detail.roll ?? 0,
                    saveBonus,
                    saveTotal: detail.total ?? 0,
                    saveDc,
                    saveSuccess: success,
                }).catch((e) => { console.error('[ElementalAttunementModal] Error logging player effect:', e); });

                setResults(prev => [...prev, {
                    targetName,
                    success,
                    roll: detail.roll ?? 0,
                    total: detail.total ?? 0,
                    saveBonus,
                    effect: elementData?.effect,
                }]);
            }

            setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));
        };

        window.addEventListener('save-result', handleSaveEvent);
        return () => window.removeEventListener('save-result', handleSaveEvent);
    }, [pendingPrompts.length, campaignName, action.name, playerStats.name, chosenElement, elementData, saveType, saveDc, pendingPrompts]);

    const handleSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    const handleResultsClose = useCallback(() => {
        setRuntimeValue(playerStats.name, 'elementalAttunementActive', true, campaignName);
        setRuntimeValue(playerStats.name, 'elementalAttunementElement', chosenElement, campaignName);

        addExpiration(
            playerStats.name,
            playerStats.name,
            [
                { type: 'clear_runtime_value', creatureName: playerStats.name, key: 'elementalAttunementActive' },
                { type: 'clear_runtime_value', creatureName: playerStats.name, key: 'elementalAttunementElement' },
                { type: 'remove_active_buff', buffName: 'Stride of the Elements' },
                { type: 'clear_runtime_value', creatureName: playerStats.name, key: 'elementalEpitomeActive' },
                { type: 'clear_runtime_value', creatureName: playerStats.name, key: 'epitomeResistanceType' },
                { type: 'clear_runtime_value', creatureName: playerStats.name, key: 'epitomeEmpoweredUsedRound' },
            ],
            campaignName,
            Infinity,
            playerStats.name
        );

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${playerStats.name}'s <strong>Elemental Attunement (${chosenElement})</strong> expires on their next turn.`,
        }).catch((e) => { console.error('[ElementalAttunementModal] Error logging expiration:', e); });

        setPhase('done');
        onClose();
    }, [playerStats.name, campaignName, chosenElement, action.name, onClose]);

    if (phase === 'element') {
        return (
            <div className="sp-overlay" onClick={handleSkip}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Elemental Attunement
                    </div>
                    <div className="sp-body">
                        <p>Choose the element for your manifestation:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                            {Object.entries(ELEMENT_DATA).map(([name, data]) => (
                                <button
                                    key={name}
                                    className="sp-roll-btn"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 16px',
                                        textAlign: 'left',
                                        margin: '0',
                                    }}
                                    onClick={() => handleElementChoice(name)}
                                >
                                    <i className={`fa-solid ${data.icon}`} style={{ fontSize: '1.4em', width: '30px', textAlign: 'center' }}></i>
                                    <div>
                                        <strong>{name}</strong>
                                        <div style={{ fontSize: '0.85em', opacity: 0.8, marginTop: '2px' }}>
                                            {ELEMENT_DESCRIPTIONS[name]}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-dismiss-btn" onClick={handleSkip}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'creatureSelection') {
        return (
            <CreatureSelectionModal
                title="Elemental Attunement"
                icon="fa-wand-magic-sparkles"
                targets={targets}
                description={`Select creatures within the ${chosenElement} manifestation. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`}
                note={elementData?.damage
                    ? `On a failed save, target takes ${elementData.damage} ${elementData.damageType} damage. On a successful save, target takes half damage.`
                    : `On a failed save, target suffers the ${chosenElement} effect.`}
                confirmLabel="Activate"
                confirmIcon="fa-wand-magic-sparkles"
                onConfirm={handleCreatureSelectionConfirm}
                onSkip={handleCreatureSelectionSkip}
            />
        );
    }

    if (phase === 'processing') {
        return (
            <div className="sp-overlay" onClick={() => {}}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Elemental Attunement ({chosenElement})
                    </div>
                    <div className="sp-body">
                        <p>Resolving {saveType} saving throws (DC {saveDc})...</p>
                        <div className="abjure-results-list">
                            {results.map(r => (
                                <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                                    <strong>{r.targetName}</strong>: {r.success
                                        ? (r.finalDamage ?? 0) > 0
                                            ? `Saved — takes ${r.finalDamage} ${r.damageType || ''} damage (rolled ${r.roll ?? 0}, halved)`
                                            : 'Saved — no effect (rolled ' + (r.roll ?? 0) + ')'
                                        : 'Failed — ' + (r.effect === 'speed_reduction' ? 'speed reduced by 15 ft.' : 'takes ' + (r.finalDamage ?? 0) + ' ' + (r.damageType || '') + ' damage (rolled ' + (r.roll ?? 0) + ')') }
                                </div>
                            ))}
                            {pendingPrompts.map(p => (
                                <div key={p.promptId} className="abjure-result abjure-result-pending">
                                    <strong>{p.targetName}</strong>: <em>Waiting for save roll...</em>
                                </div>
                            ))}
                        </div>
                        {pendingPrompts.length === 0 && results.length > 0 && !phase.startsWith('summary') && (
                            <p className="sp-note" style={{ marginTop: '8px' }}>All targets resolved.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'summary' && results.length > 0) {
        return (
            <div className="sp-overlay" onClick={() => {}}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Elemental Attunement ({chosenElement}) — Results
                    </div>
                    <div className="sp-body">
                        <div className="aoe-summary">
                            <div className="aoe-damage-info">Save DC {saveDc} {saveType}</div>
                            <div className="aoe-results">
                                {results.map(r => {
                                    const resultClass = r.success ? 'abjure-result-success' : 'abjure-result-fail';
                                    return (
                                        <div key={r.targetName} className={resultClass}>
                                            <strong>{r.targetName}</strong>: {r.effect === 'speed_reduction'
                                                ? r.success
                                                    ? `Saved (d20 ${r.roll ?? 0}+${r.saveBonus} = ${r.total}) — no effect.`
                                                    : `Failed (d20 ${r.roll ?? 0}+${r.saveBonus} = ${r.total}) — speed reduced by 15 ft.`
                                                : <span>{r.success ? 'Saved' : 'Failed'} (d20 {r.roll ?? 0}+{r.saveBonus} = {r.total}). {r.formula} {r.damageType}: <strong>{r.formula}</strong> [{(r.rolls || []).join(', ')}] = {r.rawDamage} → <strong>{r.finalDamage}</strong> {r.damageType} damage</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={handleResultsClose} type="button">
                            <i className="fa-solid fa-check"></i> Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

export default ElementalAttunementModal;
