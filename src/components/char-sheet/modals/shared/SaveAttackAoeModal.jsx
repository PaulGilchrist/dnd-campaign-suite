import React, { useState, useCallback, useEffect } from 'react';
import { rollExpression } from '../../../../services/dice/diceRoller.js';
import { resolveScaling } from '../../../../services/combat/automation/automationExpressions.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { applyDamageToTarget, computeDamageAfterSave, computeDamageAfterResistancesWithDetails } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import CreatureSelectionModal from './CreatureSelectionModal.jsx';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';
import { renderTargetList, persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';

function SaveAttackAoeModal({
    action,
    playerStats,
    campaignName,
    _shape,
    range,
    damage,
    damageType,
    saveType,
    saveDc,
    dcSuccess,
    activeOverlay,
    metamagicCareful,
    onClose,
}) {
    const [summary, setSummary] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [pendingPrompts, setPendingPrompts] = useState([]);
    const [results, setResults] = useState([]);

    const isCarefulSpell = metamagicCareful || false;
    const allyList = isCarefulSpell ? getAllyList(playerStats.name) : null;
    const isCarefulAlly = useCallback((name) => allyList ? allyList.includes(name) : false, [allyList]);

    useEffect(() => {
        return () => {
            setSummary(null);
            setSelected(new Set());
            setPendingPrompts([]);
            setResults([]);
        };
    }, []);

    useEffect(() => {
        if (pendingPrompts.length === 0 && results.length > 0 && !summary) {
            const selectedNames = results.map(r => r.targetName);
            setSummary({ results, selected: new Set(selectedNames) });
        }
    }, [pendingPrompts.length, results, summary]);

    const resolveAllSavesAndDamage = useCallback(async (selectedNames) => {
        const combatSummary = getCombatSummary(campaignName);
        if (!combatSummary) return;

        const results = [];
        const prompts = [];
        const characters = combatSummary?.creatures?.filter(c => c.type === 'player') || [];
        const scalingEntry = resolveScaling(playerStats, action.automation?.scaling);
        const resolvedDamage = scalingEntry?.damage || damage;

        for (const targetName of selectedNames) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            if (!target) continue;

            const isNpc = target.type === 'npc';
            const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;

            if (isNpc) {
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);

                const saveRoll = Math.floor(Math.random() * 20) + 1;
                const saveTotal = saveRoll + saveBonus;
                const success = saveTotal >= saveDc;
                const damageRoll = rollExpression(resolvedDamage);
                const rawDamage = damageRoll?.total ?? 0;
                const damageAfterSave = computeDamageAfterSave(rawDamage, success, dcSuccess);

                const targetCreature = combatSummary.creatures.find(c => c.name === targetName);
                const resistances = targetCreature?.resistances || [];
                const immunities = targetCreature?.immunities || [];
                const resResult = computeDamageAfterResistancesWithDetails(damageAfterSave, [damageType], resistances, immunities, false);
                let finalDamage = resResult.finalDamage;

                if (carefulSpellProtected) {
                    finalDamage = 0;
                }

                if (finalDamage > 0) {
                    applyDamageToTarget(
                        combatSummary, targetName, finalDamage, [damageType],
                        campaignName, characters, true, playerStats.name, false
                    );

                    addEntry(campaignName, {
                        type: 'roll',
                        characterName: playerStats.name,
                        rollType: 'save-damage',
                        name: action.name,
                        formula: resolvedDamage,
                        rolls: damageRoll?.rolls ?? [],
                        total: rawDamage,
                        modifier: damageRoll?.modifier ?? 0,
                        damageType: damageType,
                        targetName,
                        saveType: saveType,
                        saveDc: saveDc,
                        dcSuccess: dcSuccess,
                        saveResult: success ? 'success' : 'failure',
                        saveRoll: saveRoll,
                        saveBonus,
                        saveRawRolls: [saveRoll, saveRoll],
                        finalDamage: finalDamage,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging save:', e); });
                }

                results.push({
                    targetName,
                    success,
                    roll: saveRoll,
                    total: saveTotal,
                    saveBonus,
                    rawDamage,
                    finalDamage,
                });
            } else {
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);

                if (carefulSpellProtected) {
                    applyDamageToTarget(
                        combatSummary, targetName, 0, [damageType],
                        campaignName, characters, true, playerStats.name, false
                    );

                    results.push({
                        targetName,
                        success: true,
                        roll: null,
                        total: 0,
                        saveBonus: 0,
                        rawDamage: 0,
                        finalDamage: 0,
                    });
                } else {
                    const promptId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                    const scalingEntry = resolveScaling(playerStats, action.automation?.scaling);
                    const resolvedDamage = scalingEntry?.damage || damage;
                    const damageRoll = rollExpression(resolvedDamage);
                    const rawDamage = damageRoll?.total ?? 0;

                    sendSavePrompt(campaignName, {
                        promptId,
                        targetName,
                        saveType: saveType,
                        saveDc: saveDc,
                        sourceName: playerStats.name,
                        rawDamage,
                    });

                    const existingPrompts = getRuntimeValue(campaignName, 'pendingSaveListenerPrompts') || new Set();
                    existingPrompts.add(promptId);
                    setRuntimeValue(campaignName, 'pendingSaveListenerPrompts', existingPrompts, campaignName);

                    prompts.push({ promptId, targetName });
                }
            }
        }

        persistAndNotify(combatSummary, campaignName);
        return { results, prompts };
    }, [campaignName, action.name, action.automation?.scaling, playerStats, damage, damageType, dcSuccess, saveDc, saveType, isCarefulSpell, isCarefulAlly]);

    const handleSaveResult = useCallback((event, ctx) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const targetName = pendingPrompts[pendingIndex].targetName;
        const success = detail.success;
        const saveBonus = detail.saveBonus ?? 0;

        const rawDamage = detail.rawDamage ?? 0;
        const finalDamage = computeDamageAfterSave(rawDamage, success, dcSuccess);

        const scalingEntry = resolveScaling(playerStats, action.automation?.scaling);
        const resolvedDamage = scalingEntry?.damage || damage;
        const damageRoll = rollExpression(resolvedDamage);

        if (finalDamage > 0) {
            addEntry(campaignName, {
                type: 'roll',
                characterName: playerStats.name,
                rollType: 'save-damage',
                name: action.name,
                targetName,
                saveDc: saveDc,
                saveType: saveType,
                saveResult: success ? 'success' : 'failure',
                total: detail.total ?? 0,
                rolls: [detail.roll ?? 0],
                bonus: saveBonus,
                formula: `1d20${saveBonus !== 0 ? '+' + saveBonus : ''}`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging player save:', e); });

            const combatSummary = getCombatSummary(campaignName);
            const characters = combatSummary?.creatures?.filter(c => c.type === 'player') || [];
            applyDamageToTarget(
                combatSummary, targetName, finalDamage, [damageType],
                campaignName, characters, false, playerStats.name, false
            );

            addEntry(campaignName, {
                type: 'roll',
                characterName: playerStats.name,
                rollType: 'save-damage',
                name: action.name,
                formula: resolvedDamage,
                rolls: damageRoll?.rolls ?? [],
                total: rawDamage,
                modifier: damageRoll?.modifier ?? 0,
                damageType: damageType,
                targetName,
                saveType: saveType,
                saveDc: saveDc,
                dcSuccess: dcSuccess,
                saveResult: success ? 'success' : 'failure',
                saveRoll: detail.roll ?? 0,
                saveBonus,
                saveRawRolls: [detail.roll ?? 0, detail.roll ?? 0],
                finalDamage: finalDamage,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging player damage:', e); });
        }

        persistAndNotify(getCombatSummary(campaignName), campaignName);
        const targetResult = {
            targetName,
            success,
            roll: detail.roll ?? 0,
            total: detail.total ?? 0,
            saveBonus,
            rawDamage,
            finalDamage,
        };
        if (ctx) {
            ctx.setResults(prev => {
                if (prev.some(r => r.targetName === targetName)) return prev;
                return [...prev, targetResult];
            });
            ctx.setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));
        } else {
            setResults(prev => {
                if (prev.some(r => r.targetName === targetName)) return prev;
                return [...prev, targetResult];
            });
            setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));
        }
    }, [campaignName, damage, damageType, dcSuccess, action.name, action.automation?.scaling, playerStats, saveDc, saveType, pendingPrompts]);

    useEffect(() => {
        if (pendingPrompts.length === 0) return;
        const handleSaveEvent = (event) => {
            handleSaveResult(event, null);
        };
        window.addEventListener('save-result', handleSaveEvent);
        return () => window.removeEventListener('save-result', handleSaveEvent);
    }, [pendingPrompts.length, handleSaveResult]);

    const handleApply = useCallback(async (ctx) => {
        if (!summary) {
            ctx.setProcessing(true);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: action.name,
                description: `${action.name}: Selecting ${ctx.selected.size} target(s) for save (DC ${saveDc} ${saveType})`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging feature use:', e); });

            const { results: newResults, prompts } = await resolveAllSavesAndDamage(Array.from(ctx.selected));
            ctx.setResults(newResults);
            ctx.setPendingPrompts(prompts);
        }
    }, [summary, campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSavesAndDamage]);

    const combatSummary = getCombatSummary(campaignName);
    const isOverlayTargeted = playerStats.targetName?.startsWith('overlay-');

    const eligibleTargets = React.useMemo(() => {
        if (!combatSummary?.creatures) return [];
        return combatSummary.creatures
            .filter(c => c.name !== playerStats.name)
            .map(c => ({
                ...c,
                carefulSpellProtected: isCarefulSpell && isCarefulAlly(c.name),
            }));
    }, [combatSummary, playerStats.name, isCarefulSpell, isCarefulAlly]);

    const getCreatureTargets = () => {
        return eligibleTargets.map(c => ({
            name: c.name,
            type: c.type,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            carefulSpellProtected: c.carefulSpellProtected,
        }));
    };

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

    const handleCreatureSelectionConfirm = useCallback(async (selectedNames) => {
        setSelected(new Set(selectedNames));

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${action.name}: Selecting ${selectedNames.length} target(s) for save (DC ${saveDc} ${saveType})`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackAoeModal] Error logging feature use:', e); });

        const combatSummary = getCombatSummary(campaignName);
        if (!combatSummary) return;

        const { results, prompts } = await resolveAllSavesAndDamage(selectedNames);

        setResults(results);
        setPendingPrompts(prompts);

        if (prompts.length === 0 && results.length > 0) {
            setSummary({ results, selected: new Set(selectedNames) });
        }
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSavesAndDamage]);

    const handleCreatureSelectionSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    const renderBody = (ctx) => {
        if (!ctx.processing && !ctx.allResolved && !summary) {
            return (
                <>
                    <p>Select creatures in the area of effect. Each must make a <strong>{saveType}</strong> saving throw (DC {saveDc}).</p>
                    <p className="sp-note">On a failed save, target takes {damage} {damageType} damage. On a successful save, target takes half damage.</p>
                    <p className="sp-note">Targets selected: {ctx.selected.size}/{ctx.eligibleTargets.length}</p>
                    {metamagicCareful && renderTargetList({ eligibleTargets: ctx.eligibleTargets, selected: ctx.selected, toggleTarget: ctx.toggleTarget, isCarefulAlly: ctx.isCarefulAlly })}
                    {!metamagicCareful && renderTargetList({ eligibleTargets: ctx.eligibleTargets, selected: ctx.selected, toggleTarget: ctx.toggleTarget })}
                </>
            );
        }

        if (ctx.processing || ctx.pendingPrompts.length > 0) {
            return (
                <>
                    <p>Resolving {saveType} saving throws (DC {saveDc})...</p>
                    <div className="abjure-results-list">
                        {ctx.results.map(r => (
                            <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                                <strong>{r.targetName}</strong>: {r.success
                                    ? `Saved — takes ${r.finalDamage ?? 0} ${damageType} damage (rolled ${r.roll ?? 0}, halved)`
                                    : `Failed — takes ${r.finalDamage ?? 0} ${damageType} damage (rolled ${r.roll ?? 0})`}
                            </div>
                        ))}
                        {ctx.pendingPrompts.map(p => (
                            <div key={p.promptId} className="abjure-result abjure-result-pending">
                                <strong>{p.targetName}</strong>: <em>Waiting for save roll...</em>
                            </div>
                        ))}
                    </div>
                    {ctx.allResolved && (
                        <p className="sp-note" style={{ marginTop: '8px' }}>All targets resolved.</p>
                    )}
                </>
            );
        }

        return null;
    };

    const renderActions = (ctx) => {
        if (!ctx.processing && !ctx.allResolved && !summary) {
            return (
                <>
                    <button className="sp-roll-btn" onClick={() => handleApply(ctx)} disabled={ctx.selected.size === 0 || ctx.processing} type="button">
                        <i className="fa-solid fa-bomb"></i> {action.name} ({ctx.selected.size} target{ctx.selected.size !== 1 ? 's' : ''})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">Cancel</button>
                </>
            );
        }

        if (ctx.allResolved && ctx.pendingPrompts.length === 0 && summary === null) {
            setSummary({
                results: [...ctx.results],
                selected: ctx.selected,
            });
        }

        return null;
    };

    const extraState = { selected, setSelected, toggleTarget };

    if (summary) {
        return (
            <div className="sp-overlay" onClick={() => {}}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-bomb"></i> {action.name} — Results
                    </div>
                    <div className="sp-body">
                        <div className="abjure-results-list">
                            {summary.results.map(r => (
                                <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                                    <strong>{r.targetName}</strong>: {r.success
                                        ? `Saved — takes ${r.finalDamage ?? 0} ${damageType} damage (rolled ${r.roll ?? 0}, halved)`
                                        : `Failed — takes ${r.finalDamage ?? 0} ${damageType} damage (rolled ${r.roll ?? 0})`}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose} type="button">
                            <i className="fa-solid fa-check"></i> Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isOverlayTargeted && activeOverlay) {
        return (
            <AreaEffectTargetModalBase
                combatSummary={combatSummary}
                attackerName={playerStats.name}
                attackerPos={null}
                saveDc={saveDc}
                campaignName={campaignName}
                mapData={null}
                featureName={action.name}
                saveType={saveType}
                rangeFeet={range}
                onClose={onClose}
                icon="fa-solid fa-bomb"
                handleApplyOverride={handleApply}
                handleSaveResultOverride={handleSaveResult}
                extraState={extraState}
                renderBody={renderBody}
                renderActions={renderActions}
            />
        );
    }

    return (
        <CreatureSelectionModal
            title={action.name}
            icon="fa-bomb"
            targets={getCreatureTargets()}
            description={`Select creatures in the area of effect. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`}
            note={`On a failed save, target takes ${damage} ${damageType} damage. On a successful save, target takes half damage.`}
            confirmLabel={action.name}
            confirmIcon="fa-bomb"
            onConfirm={handleCreatureSelectionConfirm}
            onSkip={handleCreatureSelectionSkip}
        />
    );
}

export default SaveAttackAoeModal;
