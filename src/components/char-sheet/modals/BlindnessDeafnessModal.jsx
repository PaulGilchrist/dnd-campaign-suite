import React, { useState, useCallback, useEffect } from 'react';
import './BlindnessDeafnessModal.css';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { addCondition } from '../../../services/combat/conditions/conditionSaveService.js';
import utils from '../../../services/ui/utils.js';
import { sendSavePrompt, sendSaveResult } from '../../../services/combat/conditions/savePromptService.js';
import { getEffectOptions } from '../../../services/automation/handlers/spells/blindnessDeafnessHandler.js';
import AreaEffectTargetModalBase from './shared/AreaEffectTargetModalBase.jsx';
import { renderTargetList, logSaveEntry, persistAndNotify } from './shared/AreaEffectTargetModalBase.utils.jsx';
import { addEntry } from '../../../services/ui/logService.js';

function BlindnessDeafnessModal({ combatSummary, attackerName, attackerPos, saveDc, campaignName, mapData, onClose, characters, featureName = 'Blindness/Deafness', rangeFeet = 120 }) {
    const [selectedEffect, setSelectedEffect] = useState(null);
    const [affectedTargets, setAffectedTargets] = useState([]);

    const effectOptions = getEffectOptions();

    const applyConditionToCreature = useCallback((targetName, saveDcValue, condKey, ctx) => {
        const effectDef = effectOptions.find(e => e.key === condKey);
        if (!effectDef) return;

        const targetCharacter = characters?.find(c => utils.getName(c.name) === targetName);
        const targetStats = targetCharacter?.computedStats || targetCharacter;

        addCondition({
            combatSummary: ctx.combatSummary,
            creatureName: targetName,
            conditionDef: effectDef,
            dc: saveDcValue,
            ability: 'CON',
            getRuntimeValue,
            setRuntimeValue,
            campaignName,
            playerStats: targetStats,
        });
    }, [campaignName, characters, effectOptions]);

    const addConditionToCreature = useCallback((targetName, saveDcValue, effect, ctx) => {
        applyConditionToCreature(targetName, saveDcValue, effect.condition, ctx);

        const effectKey = `blindnessDeafness_${effect.condition}`;
        setRuntimeValue(targetName, effectKey, true, campaignName);

        addExpiration(attackerName, targetName, [
            { type: 'condition', condition: effect.condition },
        ], campaignName);

        setAffectedTargets(prev => [...prev, { targetName, condition: effect.condition }]);

        addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: effect.label,
            dc: saveDcValue,
            ability: 'CON',
            sourceName: attackerName,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[BlindnessDeafness] Error:', e); });
    }, [attackerName, campaignName, applyConditionToCreature]);

    const handleSelectEffect = useCallback((effect) => {
        setSelectedEffect(effect);
    }, []);

    const handleApplyOverride = useCallback((ctx) => {
        const effect = ctx.selectedEffect;
        if (!effect || ctx.selected.size === 0) return;
        ctx.setProcessing(true);

        const targetName = ctx.selected.values().next().value;
        const target = ctx.combatSummary.creatures.find(c => c.name === targetName);
        const isNpc = !target || target.type === 'npc';

        if (isNpc) {
            const saveBonus = target?.saveBonuses?.con ?? 0;
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
                addConditionToCreature(targetName, saveDc, effect, ctx);
            }

            const npcResults = [{ targetName, success, roll: roll1, total, saveBonus }];

            logSaveEntry({ campaignName, featureName, attackerName, targetName, saveDc, saveType: 'CON', success, total, rolls: [roll1], bonus: saveBonus, formula: `1d20${saveBonus !== 0 ? '+' + saveBonus : ''}` });

            persistAndNotify(ctx.combatSummary, campaignName);

            ctx.setResults(npcResults);
            ctx.setPendingPrompts([]);
            return;
        }

        const promptId = utils.guid();
        sendSavePrompt(campaignName, {
            promptId,
            targetName,
            saveType: 'CON',
            saveDc,
            sourceName: attackerName,
        });

        logSaveEntry({ campaignName, featureName, attackerName, targetName, saveDc, saveType: 'CON', success: false, total: 0, rolls: [], bonus: 0, formula: '1d20 (waiting)' });

        persistAndNotify(ctx.combatSummary, campaignName);

        ctx.setResults([]);
        ctx.setPendingPrompts([{ promptId, targetName }]);
    }, [campaignName, attackerName, saveDc, featureName, addConditionToCreature]);

    const handleSaveResultOverride = useCallback((event, ctx) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = ctx.pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const pendingTarget = ctx.pendingPrompts[pendingIndex];
        const targetName = pendingTarget.targetName;
        const success = detail.success;

        if (!success && selectedEffect) {
            addConditionToCreature(targetName, saveDc, selectedEffect, ctx);
        }

        logSaveEntry({ campaignName, featureName, attackerName, targetName, saveDc, saveType: 'CON', success, total: detail.total ?? 0, rolls: [detail.roll ?? 0], bonus: detail.saveBonus ?? 0, formula: `1d20${detail.saveBonus !== 0 ? '+' + detail.saveBonus : ''}` });

        persistAndNotify(ctx.combatSummary, campaignName);

        ctx.setResults(prev => [...prev, { targetName, success, roll: detail.roll ?? 0, total: detail.total ?? 0, saveBonus: detail.saveBonus ?? 0 }]);
        ctx.setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));
    }, [campaignName, attackerName, saveDc, featureName, addConditionToCreature, selectedEffect]);

    const effectLabel = selectedEffect ? selectedEffect.label : '';

    useEffect(() => {
        const handleInitiativeRolled = (e) => {
            if (!e.detail || !e.detail.characterName) return;
            const rollingName = utils.getName(e.detail.characterName);
            const casterName = utils.getName(attackerName);
            if (rollingName !== casterName) return;

            const conditionsToRemove = [];
            const flagsToRemove = [];

            affectedTargets.forEach(({ targetName: tName, condition }) => {
                const storedConditions = getRuntimeValue(tName, 'activeConditions') || [];
                const filtered = storedConditions.filter(c => String(c).toLowerCase() !== condition);
                setRuntimeValue(tName, 'activeConditions', filtered, campaignName);

                const effectKey = `blindnessDeafness_${condition}`;
                flagsToRemove.push({ target: tName, key: effectKey });

                conditionsToRemove.push(condition);
            });

            flagsToRemove.forEach(({ target, key }) => {
                setRuntimeValue(target, key, null, campaignName);
            });

            if (conditionsToRemove.length > 0) {
                addEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: attackerName,
                    condition: conditionsToRemove.join(' & '),
                    reason: 'Initiative rolled - new combat',
                    sourceName: attackerName,
                    timestamp: Date.now(),
                }).catch((e) => { console.error('[BlindnessDeafness] Initiative clear error:', e); });
            }

            setAffectedTargets([]);
        };

        window.addEventListener('initiative-rolled', handleInitiativeRolled);
        return () => {
            window.removeEventListener('initiative-rolled', handleInitiativeRolled);
        };
    }, [attackerName, campaignName, affectedTargets]);

    const renderBody = (ctx) => {
        if (!ctx.selectedEffect) {
            return (
                <>
                    <p>Choose an effect for the target:</p>
                    <div className="blindness-deafness-effects-list">
                        {effectOptions.map(effect => (
                            <button
                                key={effect.key}
                                className={`blindness-deafness-effect-btn ${selectedEffect?.key === effect.key ? 'blindness-deafness-effect-selected' : ''}`}
                                onClick={() => handleSelectEffect(effect)}
                                type="button"
                            >
                                <strong>{effect.label}</strong>
                                <span className="blindness-deafness-effect-desc">
                                    {effect.key === 'blinded' && 'Target is blinded'}
                                    {effect.key === 'deafened' && 'Target is deafened'}
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            );
        }

        if (!ctx.processing) {
            return (
                <>
                    <p>Effect: <strong>{effectLabel}</strong>. Select a creature within {rangeFeet} feet. It must make a <strong>CON</strong> saving throw (DC {saveDc}) or be affected.</p>
                    <p className="sp-note">Targets selected: {ctx.selected.size}/{ctx.eligibleTargets.length}</p>
                    {renderTargetList({ eligibleTargets: ctx.eligibleTargets, selected: ctx.selected, toggleTarget: ctx.toggleTarget })}
                </>
            );
        }

        return (
            <>
                <p>Resolving CON saving throws (DC {saveDc}) for <strong>{effectLabel}</strong>...</p>
                <div className="abjure-results-list">
                    {ctx.results.map(r => (
                        <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                            <strong>{r.targetName}</strong>: {r.success ? 'Saved — unaffected' : `Failed — ${effectLabel}!`}{typeof r.roll === 'number' && <> (Roll: {r.roll}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = {r.total})</>}
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
    };

    const renderActions = (ctx) => {
        if (!ctx.processing) {
            if (!ctx.selectedEffect) {
                return (
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">
                        Cancel
                    </button>
                );
            }
            return (
                <>
                    <button className="sp-roll-btn" onClick={ctx.handleApply} disabled={ctx.selected.size === 0} type="button">
                        <i className="fa-solid fa-dice-d20"></i> {featureName} ({ctx.selected.size} target)
                    </button>
                    <button className="sp-dismiss-btn" onClick={() => setSelectedEffect(null)} type="button">
                        Back
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">
                        Cancel
                    </button>
                </>
            );
        }

        if (ctx.allResolved) {
            return (
                <button className="sp-roll-btn" onClick={onClose} type="button">
                    Done
                </button>
            );
        }

        return null;
    };

    const extraState = { selectedEffect, setSelectedEffect };

    return (
        <AreaEffectTargetModalBase
            combatSummary={combatSummary}
            attackerName={attackerName}
            attackerPos={attackerPos}
            saveDc={saveDc}
            campaignName={campaignName}
            mapData={mapData}
            featureName={featureName}
            saveType="CON"
            rangeFeet={rangeFeet}
            onClose={onClose}
            characters={characters}
            icon="fa-solid fa-eye"
            handleApplyOverride={handleApplyOverride}
            handleSaveResultOverride={handleSaveResultOverride}
            extraState={extraState}
            renderBody={renderBody}
            renderActions={renderActions}
        />
    );
}

export default BlindnessDeafnessModal;
