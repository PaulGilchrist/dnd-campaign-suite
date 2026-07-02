import React, { useState, useCallback } from 'react';
import './EyebiteEffectModal.css';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { playerIsImmuneToCondition } from '../../../services/combat/automation/automationService.js';
import utils from '../../../services/ui/utils.js';
import { sendSavePrompt, sendSaveResult } from '../../../services/combat/conditions/savePromptService.js';
import { getEffectOptions } from '../../../services/automation/handlers/spells/eyebiteHandler.js';
import AreaEffectTargetModalBase from './shared/AreaEffectTargetModalBase.jsx';
import { renderTargetList, logSaveEntry, persistAndNotify } from './shared/AreaEffectTargetModalBase.utils.jsx';

function EyebiteEffectModal({ combatSummary, attackerName, attackerPos, saveDc, campaignName, mapData, onClose, characters, featureName = 'Eyebite', rangeFeet = 60, durationRounds = 10 }) {
    const [selectedEffect, setSelectedEffect] = useState(null);

    const effectOptions = getEffectOptions();

    const applyConditionToCreature = useCallback((targetName, saveDcValue, condKey, ctx) => {
        const creature = ctx.combatSummary.creatures.find(c => c.name === targetName);
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
            const conditions = getRuntimeValue(creature.name, 'activeConditions') || [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
            setRuntimeValue(creature.name, 'activeConditions', [...filtered, condKey], campaignName);
        }
    }, [campaignName, characters]);

    const addConditionToCreature = useCallback((targetName, saveDcValue, effect, ctx) => {
        applyConditionToCreature(targetName, saveDcValue, effect.condition, ctx);

        addExpiration(attackerName, targetName, [
            { type: effect.condition, condition: effect.condition },
        ], campaignName, durationRounds);
    }, [attackerName, campaignName, durationRounds, applyConditionToCreature]);

    const handleSelectEffect = useCallback((effect) => {
        setSelectedEffect(effect);
    }, []);

    const handleApplyOverride = useCallback((ctx) => {
        const effect = ctx.selectedEffect;
        if (!effect || ctx.selected.size === 0) return;
        ctx.setProcessing(true);

        const npcResults = [];
        const playerPrompts = [];

        ctx.selected.forEach(targetName => {
            const target = ctx.combatSummary.creatures.find(c => c.name === targetName);
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
                    addConditionToCreature(targetName, saveDc, effect, ctx);
                }

                npcResults.push({ targetName, success, roll: roll1, total, saveBonus });

                logSaveEntry(campaignName, featureName, attackerName, targetName, saveDc, 'WIS', success, total, [roll1], saveBonus, `1d20${saveBonus !== 0 ? '+' + saveBonus : ''}`);
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

                logSaveEntry(campaignName, featureName, attackerName, targetName, saveDc, 'WIS', false, 0, [], 0, '1d20 (waiting)');
            }
        });

        persistAndNotify(ctx.combatSummary, campaignName);

        ctx.setResults(npcResults);
        ctx.setPendingPrompts(playerPrompts);
    }, [campaignName, attackerName, saveDc, featureName, addConditionToCreature]);

    const handleSaveResultOverride = useCallback((event, ctx) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = ctx.pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const pendingTarget = ctx.pendingPrompts[pendingIndex];
        const targetName = pendingTarget.targetName;
        const success = detail.success;

        if (!success) {
            addConditionToCreature(targetName, saveDc, ctx.selectedEffect, ctx);
        }

        logSaveEntry(campaignName, featureName, attackerName, targetName, saveDc, 'WIS', success, detail.total ?? 0, [detail.roll ?? 0], detail.saveBonus ?? 0, `1d20${detail.saveBonus !== 0 ? '+' + detail.saveBonus : ''}`);

        persistAndNotify(ctx.combatSummary, campaignName);

        ctx.setResults(prev => [...prev, { targetName, success, roll: detail.roll ?? 0, total: detail.total ?? 0, saveBonus: detail.saveBonus ?? 0 }]);
        ctx.setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));
    }, [campaignName, attackerName, saveDc, featureName, addConditionToCreature]);

    const effectLabel = selectedEffect ? selectedEffect.label : '';

    const renderBody = (ctx) => {
        if (!ctx.selectedEffect) {
            return (
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
            );
        }

        if (!ctx.processing) {
            return (
                <>
                    <p>Effect: <strong>{effectLabel}</strong>. Select creatures within {rangeFeet} feet. Each must make a <strong>WIS</strong> saving throw (DC {saveDc}) or be affected.</p>
                    <p className="sp-note">Targets selected: {ctx.selected.size}/{ctx.eligibleTargets.length}</p>
                    {renderTargetList({ eligibleTargets: ctx.eligibleTargets, selected: ctx.selected, toggleTarget: ctx.toggleTarget })}
                </>
            );
        }

        return (
            <>
                <p>Resolving WIS saving throws (DC {saveDc}) for <strong>{effectLabel}</strong>...</p>
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
                        <i className="fa-solid fa-dice-d20"></i> {featureName} ({ctx.selected.size} target{ctx.selected.size !== 1 ? 's' : ''})
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
            saveType="WIS"
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

export default EyebiteEffectModal;
