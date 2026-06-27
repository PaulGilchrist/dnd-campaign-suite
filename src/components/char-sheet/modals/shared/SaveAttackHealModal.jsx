import React, { useState, useCallback } from 'react';
import { sendSavePrompt, sendSaveResult } from '../../../../services/combat/conditions/savePromptService.js';
import { rollExpression } from '../../../../services/dice/diceRoller.js';
import { addEntry } from '../../../../services/ui/logService.js';
import utils from '../../../../services/ui/utils.js';
import { applyHealingDirectly, logHealingToSSE } from '../../../../services/automation/common/healingRoll.js';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';
import { renderTargetList, logSaveEntry, persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';

function SaveAttackHealModal({ combatSummary, attackerName, attackerPos, saveDc, campaignName, mapData, featureName, saveType, rangeFeet, damageExpression, damageType, healExpression, onClose }) {
    const [healedTarget, setHealedTarget] = useState(null);
    const [healResult, setHealResult] = useState(null);

    const handleApplyOverride = useCallback((ctx) => {
        if (ctx.selected.size === 0) return;
        ctx.setProcessing(true);

        const npcResults = [];
        const playerPrompts = [];

        ctx.selected.forEach(targetName => {
            const target = ctx.combatSummary.creatures.find(c => c.name === targetName);
            const isNpc = !target || target.type === 'npc';

            if (isNpc) {
                const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;
                const roll1 = rollExpression('1d20');
                const total = roll1?.total ?? roll1;
                const success = total >= saveDc;

                sendSaveResult(campaignName, targetName, {
                    promptId: utils.guid(),
                    success,
                    roll: roll1?.total ?? roll1,
                    total,
                    saveBonus,
                    rawRolls: [roll1?.total ?? roll1, roll1?.total ?? roll1],
                });

                npcResults.push({ targetName, success, roll: roll1?.total ?? roll1, total, saveBonus });

                logSaveEntry(campaignName, featureName, attackerName, targetName, saveDc, saveType, success, total, [roll1?.total ?? roll1], saveBonus, `1d20${saveBonus !== 0 ? '+' + saveBonus : ''}`);
            } else {
                const promptId = utils.guid();
                sendSavePrompt(campaignName, {
                    promptId,
                    targetName,
                    saveType,
                    saveDc,
                    sourceName: attackerName,
                });
                playerPrompts.push({ promptId, targetName });

                logSaveEntry(campaignName, featureName, attackerName, targetName, saveDc, saveType, false, 0, [], 0, '1d20 (waiting)');
            }
        });

        persistAndNotify(ctx.combatSummary, campaignName);

        ctx.setResults(npcResults);
        ctx.setPendingPrompts(playerPrompts);
    }, [campaignName, attackerName, saveDc, saveType, featureName]);

    const handleSaveResultOverride = useCallback((event, ctx) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = ctx.pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const pendingTarget = ctx.pendingPrompts[pendingIndex];
        const targetName = pendingTarget.targetName;
        const success = detail.success;

        logSaveEntry(campaignName, featureName, attackerName, targetName, saveDc, saveType, success, detail.total ?? 0, [detail.roll ?? 0], detail.saveBonus ?? 0, `1d20${detail.saveBonus !== 0 ? '+' + detail.saveBonus : ''}`);

        persistAndNotify(ctx.combatSummary, campaignName);

        ctx.setResults(prev => [...prev, { targetName, success, roll: detail.roll ?? 0, total: detail.total ?? 0, saveBonus: detail.saveBonus ?? 0 }]);
        ctx.setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));
    }, [campaignName, attackerName, saveDc, featureName, saveType]);

    const handleHeal = useCallback((ctx) => {
        if (!healedTarget) return;
        ctx.setProcessing(true);

        const rollResult = rollExpression(healExpression);
        if (!rollResult) {
            ctx.setProcessing(false);
            return;
        }

        const healAmount = rollResult.total;
        const { newHp, maxHp, actualHeal } = applyHealingDirectly(
            { name: healedTarget, hitPoints: 0 },
            healedTarget,
            healAmount,
            campaignName
        );

        logHealingToSSE(campaignName, {
            targetName: healedTarget,
            sourceName: featureName,
            actualHeal,
            newHp,
            maxHp,
        });

        setHealResult({
            targetName: healedTarget,
            healAmount,
            actualHeal,
            newHp,
            maxHp,
            formula: healExpression,
        });

        addEntry(campaignName, {
            type: 'roll',
            name: featureName,
            characterName: attackerName,
            rollType: 'healing',
            targetName: healedTarget,
            formula: healExpression,
            total: healAmount,
            rolls: rollResult.rolls,
            bonus: 0,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackHealModal] Error:', e); });

        ctx.setProcessing(false);
    }, [healedTarget, healExpression, campaignName, attackerName, featureName]);

    const renderBody = (ctx) => {
        if (!ctx.processing && !ctx.allResolved) {
            return (
                <>
                    <p>Select creatures within {rangeFeet} feet. Each must make a <strong>{saveType}</strong> saving throw (DC {saveDc}).</p>
                    <p className="sp-note">On a failed save, target takes {damageExpression} {damageType} damage. On a successful save, target takes half damage.</p>
                    <p className="sp-note">After resolving saves, select one creature to heal for {healExpression} HP.</p>
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
                            <strong>{r.targetName}</strong>: {r.success ? 'Saved' : `Failed — takes ${damageExpression} ${damageType} damage!`}{typeof r.roll === 'number' && <> (Roll: {r.roll}{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = {r.total})</>}
                        </div>
                    ))}
                    {ctx.pendingPrompts.map(p => (
                        <div key={p.promptId} className="abjure-result abjure-result-pending">
                            <strong>{p.targetName}</strong>: <em>Waiting for save roll...</em>
                        </div>
                    ))}
                </div>
                {ctx.allResolved && (
                    <>
                        <p className="sp-note" style={{ marginTop: '8px' }}>All targets resolved.</p>
                        <p>Select one creature to heal for {healExpression} HP:</p>
                        <div className="abjure-targets-list">
                            {ctx.results.map(r => (
                                <label key={r.targetName} className={`abjure-target-row ${healedTarget === r.targetName ? 'abjure-target-selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="healTarget"
                                        checked={healedTarget === r.targetName}
                                        onChange={() => setHealedTarget(r.targetName)}
                                    />
                                    <span className="abjure-target-name">{r.targetName}</span>
                                </label>
                            ))}
                        </div>
                        {healResult && (
                            <div className="abjure-result abjure-result-success" style={{ marginTop: '8px' }}>
                                <strong>{healResult.targetName}</strong> healed for <strong>{healResult.healAmount}</strong> HP (actual: {healResult.actualHeal}). Current HP: {healResult.newHp} / {healResult.maxHp}.
                            </div>
                        )}
                    </>
                )}
            </>
        );
    };

    const renderActions = (ctx) => {
        if (!ctx.processing && !ctx.allResolved) {
            return (
                <>
                    <button className="sp-roll-btn" onClick={ctx.handleApply} disabled={ctx.selected.size === 0} type="button">
                        <i className="fa-solid fa-dice-d20"></i> {featureName} ({ctx.selected.size} target{ctx.selected.size !== 1 ? 's' : ''})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">
                        Cancel
                    </button>
                </>
            );
        }

        if (ctx.allResolved) {
            if (healResult) {
                return (
                    <button className="sp-roll-btn" onClick={onClose} type="button">Done</button>
                );
            }
            return (
                <>
                    <button className="sp-roll-btn" onClick={() => handleHeal(ctx)} disabled={!healedTarget} type="button">
                        <i className="fa-solid fa-heart"></i> Heal Selected ({healExpression})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">
                        Cancel
                    </button>
                </>
            );
        }

        return null;
    };

    const extraState = { healedTarget, setHealedTarget, healResult, setHealResult, handleHeal };

    return (
        <AreaEffectTargetModalBase
            combatSummary={combatSummary}
            attackerName={attackerName}
            attackerPos={attackerPos}
            saveDc={saveDc}
            campaignName={campaignName}
            mapData={mapData}
            featureName={featureName}
            saveType={saveType}
            rangeFeet={rangeFeet}
            onClose={onClose}
            icon="fa-solid fa-dice-d20"
            handleApplyOverride={handleApplyOverride}
            handleSaveResultOverride={handleSaveResultOverride}
            extraState={extraState}
            renderBody={renderBody}
            renderActions={renderActions}
        />
    );
}

export default SaveAttackHealModal;
