import React, { useCallback } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import { rollD20 } from '../../../../services/dice/diceRoller.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { playerIsImmuneToCondition } from '../../../../services/combat/automation/automationService.js';
import utils from '../../../../services/ui/utils.js';
import { sendSavePrompt, sendSaveResult } from '../../../../services/combat/conditions/savePromptService.js';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';
import { renderTargetList, logSaveEntry, persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';

function SetConditionModal({ combatSummary, attackerName, attackerPos, saveDc, campaignName, mapData, monsters, channelDivinityCharges, onClose, characters, featureName = 'Abjure Foes', conditionName = 'frightened', additionalCondition = null, saveType = 'WIS', rangeFeet = 60, durationRounds, shape, attackerGridX, attackerGridY }) {
    const applyConditionToCreature = useCallback((targetName, saveDcValue, condName, ctx) => {
        const creature = ctx.combatSummary.creatures.find(c => c.name === targetName);
        if (!creature) return;

        const condKey = condName.toLowerCase();

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

    const addConditionToCreature = useCallback((targetName, saveDcValue, ctx) => {
        applyConditionToCreature(targetName, saveDcValue, conditionName, ctx);

        if (additionalCondition) {
            applyConditionToCreature(targetName, saveDcValue, additionalCondition, ctx);
        }

        addExpiration(attackerName, targetName, [
            { type: conditionName.toLowerCase(), condition: conditionName.toLowerCase() },
            ...(additionalCondition ? [{ type: additionalCondition.toLowerCase(), condition: additionalCondition.toLowerCase() }] : []),
        ], campaignName, durationRounds);
    }, [attackerName, campaignName, conditionName, additionalCondition, durationRounds, applyConditionToCreature]);

    const logCondition = useCallback((targetName, saveDcValue) => {
        const conditions = [conditionName.charAt(0).toUpperCase() + conditionName.slice(1)];
        if (additionalCondition) {
            conditions.push(additionalCondition.charAt(0).toUpperCase() + additionalCondition.slice(1));
        }
        addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: conditions.join(' & '),
            dc: saveDcValue,
            ability: saveType,
            sourceName: attackerName,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SetConditionModal] Error:', e); });
    }, [campaignName, attackerName, conditionName, additionalCondition, saveType]);

    const handleApplyOverride = useCallback((ctx) => {
        if (ctx.selected.size === 0) return;
        ctx.setProcessing(true);

        if (channelDivinityCharges != null && channelDivinityCharges > 0) {
            setRuntimeValue(attackerName, 'channelDivinityCharges', channelDivinityCharges - 1, campaignName);
        }

        const npcResults = [];
        const playerPrompts = [];

        ctx.selected.forEach(targetName => {
            const target = ctx.combatSummary.creatures.find(c => c.name === targetName);
            const isPlayer = target && target.type === 'player';

            if (!isPlayer) {
                const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;
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
                    addConditionToCreature(targetName, saveDc, ctx);
                }

                npcResults.push({ targetName, success, roll: roll1, total, saveBonus });

                logSaveEntry(campaignName, featureName, attackerName, targetName, saveDc, saveType, success, total, [roll1], saveBonus, `1d20${saveBonus !== 0 ? '+' + saveBonus : ''}`);
            } else {
                const promptId = utils.guid();
                sendSavePrompt(campaignName, {
                    promptId,
                    targetName,
                    saveType,
                    saveDc,
                    sourceName: attackerName,
                    condition: conditionName,
                });
                playerPrompts.push({ promptId, targetName });
            }
        });

        persistAndNotify(ctx.combatSummary, campaignName);

        npcResults.filter(r => !r.success).forEach(r => {
            logCondition(r.targetName, saveDc);
        });

        ctx.setResults(npcResults);
        ctx.setPendingPrompts(playerPrompts);
    }, [campaignName, attackerName, saveDc, saveType, featureName, addConditionToCreature, logCondition, channelDivinityCharges, conditionName]);

    const handleSaveResultOverride = useCallback((event, ctx) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = ctx.pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const pendingTarget = ctx.pendingPrompts[pendingIndex];
        const targetName = pendingTarget.targetName;
        const success = detail.success;

        if (!success) {
            addConditionToCreature(targetName, saveDc, ctx);
            logCondition(targetName, saveDc);
        }

        logSaveEntry(campaignName, featureName, attackerName, targetName, saveDc, saveType, success, detail.total ?? 0, [detail.roll ?? 0], detail.saveBonus ?? 0, `1d20${detail.saveBonus !== 0 ? '+' + detail.saveBonus : ''}`);

        persistAndNotify(ctx.combatSummary, campaignName);

        ctx.setResults(prev => [...prev, { targetName, success, roll: detail.roll ?? 0, total: detail.total ?? 0, saveBonus: detail.saveBonus ?? 0 }]);
        ctx.setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));
    }, [campaignName, attackerName, saveDc, featureName, saveType, addConditionToCreature, logCondition]);

    const conditionLabel = conditionName.charAt(0).toUpperCase() + conditionName.slice(1)
        + (additionalCondition ? ' & ' + additionalCondition.charAt(0).toUpperCase() + additionalCondition.slice(1) : '');

    const onAllResolved = useCallback((payload) => {
        if (featureName.toLowerCase().includes('turn undead')) {
            const failedTargets = payload.results.filter(res => !res.success).map(res => res.targetName);
            if (failedTargets.length > 0) {
                window.dispatchEvent(new CustomEvent('turn-undead-result', {
                    detail: {
                        failedTargets,
                        attackerName,
                        saveDc,
                        saveType,
                        campaignName,
                    },
                }));
            }
        }
    }, [featureName, attackerName, saveDc, saveType, campaignName]);

    const isTurnUndead = featureName.toLowerCase().includes('turn undead');

    const renderBody = (ctx) => {
        if (!ctx.processing) {
            return (
                <>
                    {isTurnUndead && ctx.eligibleTargets.length === 0 && (
                        <p>No undead creatures found within range.</p>
                    )}
                    {!(isTurnUndead && ctx.eligibleTargets.length === 0) && (
                        <p>Select creatures within {rangeFeet} feet. Each must make a <strong>{saveType}</strong> saving throw (DC {saveDc}) or become <strong>{conditionLabel}</strong> for 1 minute.</p>
                    )}
                    <p className="sp-note">Targets selected: {ctx.selected.size}/{ctx.eligibleTargets.length}</p>
                    {renderTargetList({ eligibleTargets: ctx.eligibleTargets, selected: ctx.selected, toggleTarget: ctx.toggleTarget })}
                </>
            );
        }

        return (
            <>
                <p>Resolving {saveType} saving throws (DC {saveDc})...</p>
                <div className="abjure-results-list">
                    {ctx.results.map(r => (
                        <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                            <strong>{r.targetName}</strong>: {r.success ? 'Saved — unaffected' : `Failed — ${conditionLabel}!`}{typeof r.roll === 'number' && <> (Roll: {r.roll}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = {r.total})</>}
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
            return (
                <>
                    <button className="sp-roll-btn" onClick={ctx.handleApply} disabled={ctx.selected.size === 0 || (isTurnUndead && ctx.eligibleTargets.length === 0)} type="button">
                        <i className="fa-solid fa-dice-d20"></i> {featureName} ({ctx.selected.size} target{ctx.selected.size !== 1 ? 's' : ''})
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

    return (
        <AreaEffectTargetModalBase
            combatSummary={combatSummary}
            attackerName={attackerName}
            attackerPos={attackerPos}
            saveDc={saveDc}
            campaignName={campaignName}
            mapData={mapData}
            monsters={monsters}
            featureName={featureName}
            saveType={saveType}
            rangeFeet={rangeFeet}
            onClose={onClose}
            characters={characters}
            icon="fa-solid fa-dice-d20"
            handleApplyOverride={handleApplyOverride}
            handleSaveResultOverride={handleSaveResultOverride}
            onAllResolved={onAllResolved}
            renderBody={renderBody}
            renderActions={renderActions}
            turnUndead={isTurnUndead}
            shape={shape}
            attackerGridX={attackerGridX}
            attackerGridY={attackerGridY}
        />
    );
}

export default SetConditionModal;
