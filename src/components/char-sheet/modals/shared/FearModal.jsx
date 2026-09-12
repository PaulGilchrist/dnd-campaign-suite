import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import CreatureSelectionModal from './CreatureSelectionModal.jsx';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { logConditionApplied, logSaveResultEntry } from './saveResultLogging.js';

function FearModal({
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

    useEffect(() => {
        return () => {
            setPendingPrompts([]);
        };
    }, []);

    const [heightenTarget, setHeightenTarget] = useState(null);

    const isCarefulSpell = metamagicCareful || false;
    const allyList = isCarefulSpell ? getAllyList(playerStats.name) : null;
    const isCarefulAlly = useCallback((name) => allyList ? allyList.includes(name) : false, [allyList]);

    useEffect(() => {
        return () => {
            setPendingPrompts([]);
        };
    }, []);

    const applyFrightenedToTarget = useCallback((targetName, campaignName) => {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'frightened');
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'frightened'], campaignName);
    }, []);

    const trackFearEffect = useCallback((casterName, targetName, dc, campaignName) => {
        const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        const effects = Array.isArray(targetEffects) ? targetEffects : [];
        const existingIdx = effects.findIndex(
            te => te.target === targetName && te.effect === 'fear_end_on_los'
        );
        const fearEffect = {
            target: targetName,
            effect: 'fear_end_on_los',
            source: casterName,
            condition: 'frightened',
            dc: dc,
            duration: 'concentration',
        };
        if (existingIdx >= 0) {
            effects[existingIdx] = fearEffect;
        } else {
            effects.push(fearEffect);
        }
        setRuntimeValue('campaign', 'targetEffects', effects, campaignName);
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
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);
                const isHeightenTarget = heightenTarget === targetName;

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
                    }).catch((e) => { console.error('[FearModal] Error logging save result:', e); });
                    addTargetResult(campaignName, {
                        targetName,
                        saveResult: 'success',
                        roll: saveRoll,
                        total: saveTotal,
                        conditions: [],
                        appliedDamage: 0,
                    });
                    results.push({
                        targetName,
                        success: true,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        conditionApplied: false,
                    });
                } else if (!success) {
                    applyFrightenedToTarget(targetName, campaignName);
                    addExpiration(casterName, targetName, [
                        { type: 'condition', condition: 'frightened' },
                    ], campaignName);
                    trackFearEffect(casterName, targetName, saveDc, campaignName);

                    await addEntry(campaignName, {
                        type: 'condition',
                        action: 'applied',
                        characterName: targetName,
                        condition: 'Frightened',
                        dc: saveDc,
                        ability: saveType,
                        sourceName: casterName,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[FearModal] Error logging condition:', e); });

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
                    }).catch((e) => { console.error('[FearModal] Error logging save result:', e); });

                    await addEntry(campaignName, {
                        type: 'condition',
                        action: 'applied',
                        characterName: targetName,
                        condition: 'Frightened',
                        reason: 'Fear spell',
                        note: `${targetName} drops what it was holding, becomes Frightened, and must take the Dash action to move away from ${casterName} on each of its turns.`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[FearModal] Error logging condition:', e); });

                    addTargetResult(campaignName, {
                        targetName,
                        saveResult: 'failure',
                        roll: saveRoll,
                        total: saveTotal,
                        conditions: ['frightened'],
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
                    }).catch((e) => { console.error('[FearModal] Error logging save result:', e); });

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
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);

                if (carefulSpellProtected) {
                    results.push({
                        targetName,
                        success: true,
                        roll: null,
                        total: 0,
                        saveBonus: 0,
                        conditionApplied: false,
                    });
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
        }

        persistAndNotify(getCombatSummary(campaignName), campaignName);

        return { results, prompts };
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, isCarefulSpell, isCarefulAlly, heightenTarget, applyFrightenedToTarget, trackFearEffect]);

    const handleSaveResult = useCallback(async (event) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const targetName = pendingPrompts[pendingIndex].targetName;
        const success = detail.success;
        const casterName = playerStats.name;

        if (!success) {
            applyFrightenedToTarget(targetName, campaignName);
            addExpiration(casterName, targetName, [
                { type: 'condition', condition: 'frightened' },
            ], campaignName);
            trackFearEffect(casterName, targetName, saveDc, campaignName);

            await logConditionApplied(campaignName, {
                targetName,
                condition: 'Frightened',
                reason: 'Fear spell',
                note: `${targetName} drops what it was holding, becomes Frightened, and must take the Dash action to move away from ${casterName} on each of its turns.`,
                logPrefix: '[FearModal]',
            });

            await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: false, detail, logPrefix: '[FearModal]' });

            addTargetResult(campaignName, {
                targetName,
                saveResult: 'failure',
                roll: detail.roll ?? 0,
                total: detail.total ?? 0,
                conditions: ['frightened'],
                appliedDamage: 0,
            });
        } else {
            await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: true, detail, logPrefix: '[FearModal]' });

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
    }, [campaignName, saveDc, saveType, pendingPrompts, applyFrightenedToTarget, trackFearEffect, playerStats.name, onClose]);

    useEffect(() => {
        if (pendingPrompts.length === 0) return;
        const handleSaveEvent = (event) => {
            handleSaveResult(event);
        };
        window.addEventListener('save-result', handleSaveEvent);
        return () => window.removeEventListener('save-result', handleSaveEvent);
    }, [pendingPrompts.length, handleSaveResult]);

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

    const getCreatureTargets = () => {
        return eligibleTargets.map(c => ({
            name: c.name,
            type: c.type,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            carefulSpellProtected: c.carefulSpellProtected,
        }));
    };

    const handleCreatureSelectionConfirm = useCallback(async (selectedNames) => {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${action.name}: Selecting ${selectedNames.length} target(s) for save (DC ${saveDc} ${saveType})`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[FearModal] Error logging feature use:', e); });

        const { prompts } = await resolveAllSaves(selectedNames);
        setPendingPrompts(prompts);
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSaves]);

    const handleCreatureSelectionSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    if (isOverlayTargeted && activeOverlay) {
        return (
            <React.Fragment>
                {/* Overlay targeting not implemented for Fear - fall back to CreatureSelectionModal */}
            </React.Fragment>
        );
    }

    return (
        <CreatureSelectionModal
            title={action.name}
            icon="fa-dice-d20"
            targets={getCreatureTargets()}
            description={`Select creatures in the 30-foot cone. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`}
            note={`On a failed save, target drops what it is holding and becomes <strong>Frightened</strong>. While frightened, it must take the Dash action to move away from you on each of its turns.${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`}
            confirmLabel={action.name}
            confirmIcon="fa-dice-d20"
            onConfirm={handleCreatureSelectionConfirm}
            onSkip={handleCreatureSelectionSkip}
            metamagicHeighten={metamagicHeighten}
            heightenTarget={heightenTarget}
            setHeightenTarget={setHeightenTarget}
        />
    );
}

export default FearModal;
