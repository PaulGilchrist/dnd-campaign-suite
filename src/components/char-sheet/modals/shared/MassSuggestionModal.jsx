import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import CreatureSelectionModal from './CreatureSelectionModal.jsx';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { logConditionApplied, logSaveResultEntry } from './saveResultLogging.js';

function MassSuggestionModal({
    action,
    playerStats,
    campaignName,
    saveType,
    saveDc,
    onClose,
}) {
    const [pendingPrompts, setPendingPrompts] = useState([]);

    useEffect(() => {
        return () => {
            setPendingPrompts([]);
        };
    }, []);

    const applyCharmedToTarget = useCallback((targetName, campaignName) => {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed'], campaignName);
    }, []);

    const resolveAllSaves = useCallback(async (selectedNames) => {
        const combatSummary = getCombatSummary(campaignName);
        if (!combatSummary) return { results: [], prompts: [] };

        const results = [];
        const prompts = [];
        const casterName = playerStats.name;

        storeSpellLastAttack(campaignName, {
            casterName,
            spellName: action.name,
            saveType,
            saveDc,
            attackScope: 'aoe',
        });

        for (const targetName of selectedNames) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            if (!target) continue;

            const isNpc = target.type === 'npc';
            const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;

            if (isNpc) {
                const saveRoll = Math.floor(Math.random() * 20) + 1;
                const saveTotal = saveRoll + saveBonus;
                const success = saveTotal >= saveDc;

                if (!success) {
                    applyCharmedToTarget(targetName, campaignName);
                    addExpiration(casterName, targetName, [
                        { type: 'charmed', condition: 'charmed' },
                    ], campaignName);

                    await addEntry(campaignName, {
                        type: 'condition',
                        action: 'applied',
                        characterName: targetName,
                        condition: 'Charmed',
                        dc: saveDc,
                        ability: saveType,
                        sourceName: casterName,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[MassSuggestionModal] Error logging condition:', e); });

                    await addEntry(campaignName, {
                        type: 'save_result',
                        characterName: casterName,
                        targetName,
                        saveDc,
                        saveType,
                        success: false,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        description: `${targetName} failed ${saveType} save (DC ${saveDc}, rolled ${saveRoll} + ${saveBonus} = ${saveTotal})`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[MassSuggestionModal] Error logging save result:', e); });

                    await addEntry(campaignName, {
                        type: 'condition',
                        action: 'applied',
                        characterName: targetName,
                        condition: 'Charmed',
                        reason: 'Mass Suggestion spell',
                        note: `${targetName} is Charmed by Mass Suggestion and pursues the suggested course of activity. The spell ends if ${casterName} or allies deal damage to the target.`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[MassSuggestionModal] Error logging condition:', e); });

                    addTargetResult(campaignName, {
                        targetName,
                        saveResult: 'failure',
                        roll: saveRoll,
                        total: saveTotal,
                        conditions: ['charmed'],
                        appliedDamage: 0,
                    });

                    results.push({
                        targetName,
                        success: false,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        conditionApplied: true,
                    });
                } else {
                    results.push({
                        targetName,
                        success: true,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        conditionApplied: false,
                    });

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
                        description: `${targetName} succeeded on ${saveType} save (DC ${saveDc}, rolled ${saveRoll} + ${saveBonus} = ${saveTotal})`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[MassSuggestionModal] Error logging save result:', e); });

                    addTargetResult(campaignName, {
                        targetName,
                        saveResult: 'success',
                        roll: saveRoll,
                        total: saveTotal,
                        conditions: [],
                        appliedDamage: 0,
                    });
                }
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

                prompts.push({ promptId, targetName });
            }
        }

        persistAndNotify(getCombatSummary(campaignName), campaignName);

        return { results, prompts };
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, applyCharmedToTarget]);

    const handleSaveResult = useCallback(async (event) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const targetName = pendingPrompts[pendingIndex].targetName;
        const success = detail.success;
        const casterName = playerStats.name;

        if (!success) {
            applyCharmedToTarget(targetName, campaignName);
            addExpiration(casterName, targetName, [
                { type: 'charmed', condition: 'charmed' },
            ], campaignName);

            await logConditionApplied(campaignName, {
                targetName,
                condition: 'Charmed',
                reason: 'Mass Suggestion spell',
                note: `${targetName} is Charmed by Mass Suggestion and pursues the suggested course of activity. The spell ends if ${casterName} or allies deal damage to the target.`,
                logPrefix: '[MassSuggestionModal]',
            });

            await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: false, detail, logPrefix: '[MassSuggestionModal]' });

            addTargetResult(campaignName, {
                targetName,
                saveResult: 'failure',
                roll: detail.roll ?? 0,
                total: detail.total ?? 0,
                conditions: ['charmed'],
                appliedDamage: 0,
            });
        } else {
            await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: true, detail, logPrefix: '[MassSuggestionModal]' });

            addTargetResult(campaignName, {
                targetName,
                saveResult: 'success',
                roll: detail.roll ?? 0,
                total: detail.total ?? 0,
                conditions: [],
                appliedDamage: 0,
            });
        }

        persistAndNotify(getCombatSummary(campaignName), campaignName);

        setPendingPrompts(prev => {
            const updated = prev.filter(p => p.promptId !== detail.promptId);
            if (updated.length === 0) {
                setTimeout(() => onClose(), 500);
            }
            return updated;
        });
    }, [campaignName, saveDc, saveType, pendingPrompts, applyCharmedToTarget, playerStats.name, onClose]);

    useEffect(() => {
        if (pendingPrompts.length === 0) return;
        const handleSaveEvent = (event) => {
            handleSaveResult(event);
        };
        window.addEventListener('save-result', handleSaveEvent);
        return () => window.removeEventListener('save-result', handleSaveEvent);
    }, [pendingPrompts.length, handleSaveResult]);

    const combatSummary = getCombatSummary(campaignName);

    const eligibleTargets = useMemo(() => {
        if (!combatSummary?.creatures) return [];
        return combatSummary.creatures;
    }, [combatSummary]);

    const getCreatureTargets = () => {
        return eligibleTargets.map(c => ({
            name: c.name,
            type: c.type,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
        }));
    };

    const handleCreatureSelectionConfirm = useCallback(async (selectedNames) => {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${action.name}: Selecting ${selectedNames.length} target(s) for save (DC ${saveDc} ${saveType})`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[MassSuggestionModal] Error logging feature use:', e); });

        const { prompts } = await resolveAllSaves(selectedNames);
        setPendingPrompts(prompts);
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSaves]);

    const handleCreatureSelectionSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    return (
        <CreatureSelectionModal
            title={action.name}
            icon="fa-dice-d20"
            targets={getCreatureTargets()}
            description={`Select creatures within range. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`}
            note={`On a failed save, target becomes <strong>Charmed</strong> and pursues the suggested course of activity. The spell ends if you or your allies deal damage to the target. Maximum 12 targets.`}
            confirmLabel={action.name}
            confirmIcon="fa-dice-d20"
            onConfirm={handleCreatureSelectionConfirm}
            onSkip={handleCreatureSelectionSkip}
            maxTargets={12}
        />
    );
}

export default MassSuggestionModal;
