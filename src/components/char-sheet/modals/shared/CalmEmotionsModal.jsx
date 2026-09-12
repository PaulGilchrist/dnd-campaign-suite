import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { logSaveResultEntry } from './saveResultLogging.js';
import { applyCalmEmotionsImmunity, applyCalmEmotionsCharmed } from '../../../../services/automation/handlers/spells/calmEmotionsHandler.js';

function CalmEmotionsModal({
    action,
    playerStats,
    campaignName,
    saveType,
    saveDc,
    activeOverlay,
    metamagicCareful,
    metamagicHeighten,
    onClose,
}) {
    const [pendingPrompts, setPendingPrompts] = useState([]);
    const [heightenTarget, setHeightenTarget] = useState(null);
    const [targetChoices, setTargetChoices] = useState({});

    const isCarefulSpell = metamagicCareful || false;
    const allyList = isCarefulSpell ? getAllyList(playerStats.name) : null;
    const isCarefulAlly = useCallback((name) => allyList ? allyList.includes(name) : false, [allyList]);

    // Default: all creatures included, default choice = immunity
    const combatSummary = getCombatSummary(campaignName);
    const isOverlayTargeted = playerStats.targetName?.startsWith('overlay-');

    const eligibleTargets = useMemo(() => {
        if (!combatSummary?.creatures) return [];
        return combatSummary.creatures
            .map(c => ({
                ...c,
                carefulSpellProtected: isCarefulSpell && isCarefulAlly(c.name),
            }));
    }, [combatSummary, isCarefulSpell, isCarefulAlly]);

    useEffect(() => {
        const defaultChoices = {};
        const defaultIncluded = {};
        for (const c of eligibleTargets) {
            defaultIncluded[c.name] = true;
            defaultChoices[c.name] = 'immunity';
        }
        setTargetChoices(prev => ({ ...prev, ...defaultChoices }));
    }, [eligibleTargets]);

    const resolveAllSaves = useCallback(async (selectedNames) => {
        const casterName = playerStats.name;

        storeSpellLastAttack(campaignName, {
            casterName,
            spellName: action.name,
            saveType,
            saveDc,
            attackScope: 'aoe',
        });

        const results = [];
        const prompts = [];

        for (const targetName of selectedNames) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            if (!target) continue;

            const isNpc = target.type === 'npc';
            const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;
            const isHeightenTarget = heightenTarget === targetName;
            const choice = targetChoices[targetName] || 'immunity';

            // Immunity mode grants a buff directly — no save required
            if (choice === 'immunity') {
                await applyCalmEmotionsImmunity({ targetName, casterName, campaignName, dc: saveDc });
                results.push({ targetName, success: true, skipped: true, choice });
                continue;
            }

            // Charmed mode requires a save
            if (isNpc) {
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);
                const saveRoll = isHeightenTarget ? Math.min(Math.floor(Math.random() * 20) + 1, Math.floor(Math.random() * 20) + 1) : Math.floor(Math.random() * 20) + 1;
                const saveTotal = saveRoll + saveBonus;
                const success = saveTotal >= saveDc;

                if (carefulSpellProtected) {
                    await addEntry(campaignName, {
                        type: 'save_result',
                        characterName: casterName,
                        targetName,
                        saveDc,
                        saveType,
                        success: true,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        description: `${targetName} succeeded on ${saveType} save (DC ${saveDc}, rolled ${saveRoll} + ${saveBonus} = ${saveTotal}) — Careful Spell protected`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[calmEmotions] Error logging save result:', e); });
                    addTargetResult(campaignName, {
                        targetName,
                        saveResult: 'success',
                        roll: saveRoll,
                        total: saveTotal,
                        conditions: [],
                        appliedDamage: 0,
                    });
                    results.push({ targetName, success: true, roll: saveRoll, total: saveTotal, saveBonus, conditionApplied: false });
                } else if (!success) {
                    await applyCalmEmotionsCharmed({ targetName, casterName, campaignName, dc: saveDc, creature: target, characters: [] });
                    await addTargetResult(campaignName, {
                        targetName,
                        saveResult: 'failure',
                        roll: saveRoll,
                        total: saveTotal,
                        conditions: [],
                        appliedDamage: 0,
                    });
                    results.push({ targetName, success: false, roll: saveRoll, total: saveTotal, saveBonus, conditionApplied: true, choice });
                } else {
                    results.push({ targetName, success: true, roll: saveRoll, total: saveTotal, saveBonus, conditionApplied: false });
                }
            } else {
                // Player — send save prompt
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);

                if (carefulSpellProtected) {
                    results.push({ targetName, success: true, roll: null, total: 0, saveBonus: 0, conditionApplied: false });
                } else {
                    const promptId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

                    sendSavePrompt(campaignName, {
                        promptId,
                        targetName,
                        saveType: saveType,
                        saveDc: saveDc,
                        sourceName: casterName,
                    });

                    const existingPrompts = Array.from(getRuntimeValue('campaign', 'pendingSaveListenerPrompts') || []);
                    existingPrompts.push(promptId);
                    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', existingPrompts, campaignName);

                    prompts.push({ promptId, targetName, choice });
                }
            }
        }

        persistAndNotify(getCombatSummary(campaignName), campaignName);

        return { results, prompts };
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, isCarefulSpell, isCarefulAlly, heightenTarget, targetChoices, combatSummary]);

    const handleSaveResult = useCallback(async (event) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const { targetName, choice } = pendingPrompts[pendingIndex];
        const success = detail.success;
        const casterName = playerStats.name;

        if (!success) {
            if (choice === 'immunity') {
                await applyCalmEmotionsImmunity({ targetName, casterName, campaignName, dc: saveDc });
            } else {
                await applyCalmEmotionsCharmed({ targetName, casterName, campaignName, dc: saveDc, creature: null, characters: [] });
            }

            await addTargetResult(campaignName, {
                targetName,
                saveResult: 'failure',
                roll: detail.roll ?? 0,
                total: detail.total ?? 0,
                conditions: [],
                appliedDamage: 0,
            });

            await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: false, detail, logPrefix: '[calmEmotions]' });
        } else {
            await addTargetResult(campaignName, {
                targetName,
                saveResult: 'success',
                roll: detail.roll ?? 0,
                total: detail.total ?? 0,
                conditions: [],
                appliedDamage: 0,
            });

            await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: true, detail, logPrefix: '[calmEmotions]' });
        }

        persistAndNotify(getCombatSummary(campaignName), campaignName);

        setPendingPrompts(prev => {
            const updated = prev.filter(p => p.promptId !== detail.promptId);
            if (updated.length === 0) {
                setTimeout(() => onClose(), 500);
            }
            return updated;
        });
    }, [campaignName, saveDc, saveType, pendingPrompts, playerStats.name, onClose]);

    const handleCreatureSelectionConfirm = useCallback(async (selectedNames) => {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${action.name}: Selecting ${selectedNames.length} target(s) for save (DC ${saveDc} ${saveType})`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[calmEmotions] Error logging feature use:', e); });

        const { prompts } = await resolveAllSaves(selectedNames);
        setPendingPrompts(prompts);
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSaves]);

    useEffect(() => {
        if (pendingPrompts.length === 0) return;
        const handleSaveEvent = (event) => {
            handleSaveResult(event);
        };
        window.addEventListener('save-result', handleSaveEvent);
        return () => window.removeEventListener('save-result', handleSaveEvent);
    }, [pendingPrompts.length, handleSaveResult]);

    const handleToggleTarget = useCallback((targetName) => {
        setTargetChoices(prev => {
            const newIncluded = { ...prev };
            if (newIncluded[targetName]) {
                delete newIncluded[targetName];
            } else {
                newIncluded[targetName] = false;
            }
            return newIncluded;
        });
    }, []);

    const handleToggleChoice = useCallback((targetName, choice) => {
        setTargetChoices(prev => ({
            ...prev,
            [targetName]: choice,
        }));
    }, []);

    if (isOverlayTargeted && activeOverlay) {
        return (
            <React.Fragment>
                {/* Overlay targeting not implemented for Calm Emotions - fall back to target list */}
            </React.Fragment>
        );
    }

    const includedTargets = eligibleTargets.filter(c => targetChoices[c.name] !== false);

    return (
        <div className="sp-overlay" onClick={(e) => {
            if (e.target.closest('.sp-modal')) return;
            onClose?.();
        }}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-hand-holding-heart"></i> Calm Emotions
                </div>
                <div className="sp-body">
                    <p>Select creatures in the <strong>20-foot-radius sphere</strong>. Each must make a <strong>{saveType}</strong> saving throw (DC {saveDc}).</p>
                    <p className="sp-note">On a failed save, choose the effect for each creature.</p>
                    <div className="secondary-target-list">
                        {eligibleTargets.map((target) => {
                            const name = target.name;
                            const isIncluded = targetChoices[name] !== false;
                            const choice = targetChoices[name] === false ? 'immunity' : (typeof targetChoices[name] === 'object' ? targetChoices[name]?.choice : targetChoices[name] || 'immunity');
                            const isPlayer = target.type === 'player';
                            const hpDisplay = (!isPlayer && target.currentHp != null && target.maxHp != null)
                                ? `${Math.round((target.currentHp / target.maxHp) * 100)}%`
                                : null;
                            return (
                                <div key={name} className={`secondary-target-row ${isIncluded ? 'secondary-target-selected' : ''}`}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', width: '100%' }}>
                                        <input
                                            type="checkbox"
                                            checked={isIncluded}
                                            onChange={() => handleToggleTarget(name)}
                                            onClick={e => e.stopPropagation()}
                                        />
                                        <span className="secondary-target-name">
                                            <strong>{name}</strong>
                                            {hpDisplay && (
                                                <span className="secondary-target-hp">
                                                    ({hpDisplay} HP)
                                                </span>
                                            )}
                                        </span>
                                        {target.carefulSpellProtected && (
                                            <span style={{ fontSize: '0.85em', color: '#4ade80', marginLeft: '4px' }}>✓ Careful</span>
                                        )}
                                    </label>
                                    {isIncluded && (
                                        <div style={{ display: 'flex', gap: '8px', marginLeft: '24px', marginTop: '4px' }}>
                                            <label style={{ fontSize: '0.9em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="radio"
                                                    name={`choice-${name}`}
                                                    checked={choice === 'immunity'}
                                                    onChange={() => handleToggleChoice(name, 'immunity')}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                                Grant Immunity
                                            </label>
                                            <label style={{ fontSize: '0.9em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input
                                                    type="radio"
                                                    name={`choice-${name}`}
                                                    checked={choice === 'charmed'}
                                                    onChange={() => handleToggleChoice(name, 'charmed')}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                                Apply Charmed
                                            </label>
                                        </div>
                                    )}
                                    {metamagicHeighten && (
                                        <span style={{ fontSize: '0.85em', color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '24px' }}>
                                            <input
                                                type="radio"
                                                name="heightenTarget"
                                                checked={heightenTarget === name}
                                                onChange={(e) => { e.stopPropagation(); setHeightenTarget(name); }}
                                                title="Select this target for Heightened Spell disadvantage"
                                                onClick={e => e.stopPropagation()}
                                            />
                                            Heighten
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                        {eligibleTargets.length === 0 && (
                            <p className="sp-note">No targets available.</p>
                        )}
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={() => handleCreatureSelectionConfirm(includedTargets.map(c => c.name))}
                        disabled={includedTargets.length === 0}
                        type="button"
                    >
                        <i className="fa-solid fa-hand-holding-heart"></i> Cast Calm Emotions ({includedTargets.length})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CalmEmotionsModal;
