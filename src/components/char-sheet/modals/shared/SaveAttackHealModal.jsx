import React, { useState, useCallback } from 'react';
import { sendSavePrompt, sendSaveResult } from '../../../../services/combat/conditions/savePromptService.js';
import { rollExpression } from '../../../../services/dice/diceRoller.js';
import { addEntry } from '../../../../services/ui/logService.js';
import utils from '../../../../services/ui/utils.js';
import { applyHealingDirectly, logHealingToSSE } from '../../../../services/automation/common/healingRoll.js';
import { applyDamageToTarget, computeDamageAfterSave } from '../../../../services/rules/combat/applyDamage.js';
import storage from '../../../../services/ui/storage.js';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';
import { renderTargetList, logSaveEntry, persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';

function SaveAttackHealModal({ combatSummary, attackerName, attackerPos, saveDc, campaignName, mapData, featureName, saveType, rangeFeet, damageExpression, damageType, healExpression, onClose, shape, attackerGridX, attackerGridY }) {
    const [healedTarget, setHealedTarget] = useState(null);
    const [healResult, setHealResult] = useState(null);

    const resolveAllSavesAndDamage = useCallback((targets) => {
        const results = [];
        const prompts = [];
        const characters = combatSummary?.creatures?.filter(c => c.type === 'player') || [];

        for (const targetName of targets) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            const isNpc = !target || target.type === 'npc';
            const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;

            if (isNpc) {
                const saveRoll = rollExpression('1d20');
                const saveTotal = saveRoll?.total ?? 0;
                const success = saveTotal >= saveDc;

                const damageRoll = rollExpression(damageExpression);
                const rawDamage = damageRoll?.total ?? 0;
                const finalDamage = computeDamageAfterSave(rawDamage, success, 'half');

                sendSaveResult(campaignName, targetName, {
                    promptId: utils.guid(),
                    success,
                    roll: saveRoll?.total ?? 0,
                    total: saveTotal,
                    saveBonus,
                    rawRolls: [saveRoll?.total ?? 0, saveRoll?.total ?? 0],
                });

                logSaveEntry(campaignName, featureName, attackerName, targetName, saveDc, saveType, success, saveTotal, [saveRoll?.total ?? 0], saveBonus, `1d20${saveBonus !== 0 ? '+' + saveBonus : ''}`);

                if (finalDamage > 0) {
                    const applyResult = applyDamageToTarget(
                        combatSummary, targetName, finalDamage, [damageType],
                        campaignName, characters, false, attackerName, false
                    );

                    addEntry(campaignName, {
                        type: 'roll', characterName: attackerName, rollType: 'save-damage',
                        name: featureName, formula: damageExpression,
                        rolls: damageRoll?.rolls ?? [], total: rawDamage, modifier: damageRoll?.modifier ?? 0,
                        damageType, targetName, saveType, saveDc, dcSuccess: 'half',
                        saveResult: success ? 'success' : 'failure',
                        saveRoll: saveRoll?.total ?? 0, saveBonus,
                        saveRawRolls: [saveRoll?.total ?? 0, saveRoll?.total ?? 0],
                        finalDamage: applyResult?.finalDamage ?? finalDamage,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[SaveAttackHealModal] Error logging damage:', e); });
                }

                results.push({ targetName, success, roll: saveRoll?.total ?? 0, total: saveTotal, saveBonus, rawDamage, finalDamage });
            } else {
                const promptId = utils.guid();
                sendSavePrompt(campaignName, { promptId, targetName, saveType, saveDc, sourceName: attackerName });
                prompts.push({ promptId, targetName });
            }
        }

        return { results, prompts };
    }, [combatSummary, campaignName, damageExpression, damageType, featureName, attackerName, saveDc, saveType]);

    const handleApplyOverride = useCallback((ctx) => {
        if (ctx.selected.size === 0) return;
        ctx.setProcessing(true);

        addEntry(campaignName, {
            type: 'ability_use', characterName: attackerName, abilityName: featureName,
            description: `${featureName}: Selecting ${ctx.selected.size} target(s) for save (DC ${saveDc} ${saveType})`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackHealModal] Error logging feature use:', e); });

        const { results, prompts } = resolveAllSavesAndDamage(Array.from(ctx.selected));
        persistAndNotify(ctx.combatSummary, campaignName);
        ctx.setResults(results);
        ctx.setPendingPrompts(prompts);
    }, [campaignName, attackerName, saveDc, saveType, featureName, resolveAllSavesAndDamage]);

    const handleSaveResultOverride = useCallback((event, ctx) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = ctx.pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const targetName = ctx.pendingPrompts[pendingIndex].targetName;
        const success = detail.success;
        let rawDamage = 0;
        let finalDamage = 0;

        logSaveEntry(campaignName, featureName, attackerName, targetName, saveDc, saveType, success, detail.total ?? 0, [detail.roll ?? 0], detail.saveBonus ?? 0, `1d20${detail.saveBonus !== 0 ? '+' + detail.saveBonus : ''}`);

        if (!success) {
            const damageRoll = rollExpression(damageExpression);
            rawDamage = damageRoll?.total ?? 0;
            finalDamage = computeDamageAfterSave(rawDamage, success, 'half');

            if (finalDamage > 0) {
                const characters = combatSummary?.creatures?.filter(c => c.type === 'player') || [];
                const applyResult = applyDamageToTarget(
                    combatSummary, targetName, finalDamage, [damageType],
                    campaignName, characters, false, attackerName, false
                );

                addEntry(campaignName, {
                    type: 'roll', characterName: attackerName, rollType: 'save-damage',
                    name: featureName, formula: damageExpression,
                    rolls: damageRoll?.rolls ?? [], total: rawDamage, modifier: damageRoll?.modifier ?? 0,
                    damageType, targetName, saveType, saveDc, dcSuccess: 'half',
                    saveResult: 'failure',
                    saveRoll: detail.roll ?? 0, saveBonus: detail.saveBonus ?? 0,
                    saveRawRolls: [detail.roll ?? 0, detail.roll ?? 0],
                    finalDamage: applyResult?.finalDamage ?? finalDamage,
                    timestamp: Date.now(),
                }).catch((e) => { console.error('[SaveAttackHealModal] Error logging player damage:', e); });

                storage.set('combatSummary', combatSummary, campaignName);
                window.dispatchEvent(new CustomEvent('combat-summary-updated'));
            }
        } else {
            const damageRoll = rollExpression(damageExpression);
            rawDamage = damageRoll?.total ?? 0;
            finalDamage = computeDamageAfterSave(rawDamage, success, 'half');
        }

        persistAndNotify(ctx.combatSummary, campaignName);
        ctx.setResults(prev => [...prev, {
            targetName, success, roll: detail.roll ?? 0, total: detail.total ?? 0,
            saveBonus: detail.saveBonus ?? 0, rawDamage, finalDamage,
        }]);
        ctx.setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));
    }, [campaignName, attackerName, saveDc, featureName, saveType, damageExpression, damageType, combatSummary]);

    const handleHeal = useCallback((ctx) => {
        if (!healedTarget) return;
        ctx.setProcessing(true);

        const rollResult = rollExpression(healExpression);
        if (!rollResult) { ctx.setProcessing(false); return; }

        const healAmount = rollResult.total;
        const targetCreature = ctx.combatSummary?.creatures?.find(c => c.name === healedTarget);
        const targetMaxHp = targetCreature?.maxHp ?? 0;
        const { newHp, maxHp, actualHeal } = applyHealingDirectly(
            { name: healedTarget, hitPoints: targetMaxHp }, healedTarget, healAmount, campaignName, targetMaxHp
        );

        logHealingToSSE(campaignName, { targetName: healedTarget, sourceName: featureName, actualHeal, newHp, maxHp });

        setHealResult({ targetName: healedTarget, healAmount, actualHeal, newHp, maxHp, formula: healExpression });

        addEntry(campaignName, {
            type: 'roll', name: featureName, characterName: attackerName, rollType: 'healing',
            targetName: healedTarget, formula: healExpression, total: healAmount,
            rolls: rollResult.rolls, bonus: 0, timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackHealModal] Error:', e); });

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
                            <strong>{r.targetName}</strong>: {r.success
                                ? `Saved — takes ${r.finalDamage} ${damageType} damage (rolled ${r.rawDamage}, halved)`
                                : `Failed — takes ${r.finalDamage} ${damageType} damage (rolled ${r.rawDamage})`}
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
                                    <input type="radio" name="healTarget" checked={healedTarget === r.targetName} onChange={() => setHealedTarget(r.targetName)} />
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
                    <button className="sp-roll-btn" onClick={ctx.handleApply} disabled={ctx.selected.size === 0 || ctx.processing} type="button">
                        <i className="fa-solid fa-dice-d20"></i> {featureName} ({ctx.selected.size} target{ctx.selected.size !== 1 ? 's' : ''})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">Cancel</button>
                </>
            );
        }

        if (ctx.allResolved) {
            if (healResult) {
                return <button className="sp-roll-btn" onClick={onClose} type="button">Done</button>;
            }
            return (
                <>
                    <button className="sp-roll-btn" onClick={() => handleHeal(ctx)} disabled={!healedTarget} type="button">
                        <i className="fa-solid fa-heart"></i> Heal Selected ({healExpression})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">Cancel</button>
                </>
            );
        }

        return null;
    };

    const extraState = { healedTarget, setHealedTarget, healResult, setHealResult, handleHeal };

    return (
        <AreaEffectTargetModalBase
            combatSummary={combatSummary} attackerName={attackerName} attackerPos={attackerPos}
            saveDc={saveDc} campaignName={campaignName} mapData={mapData}
            featureName={featureName} saveType={saveType} rangeFeet={rangeFeet}
            onClose={onClose} icon="fa-solid fa-dice-d20"
            handleApplyOverride={handleApplyOverride} handleSaveResultOverride={handleSaveResultOverride}
            extraState={extraState} renderBody={renderBody} renderActions={renderActions}
            shape={shape} attackerGridX={attackerGridX} attackerGridY={attackerGridY}
        />
    );
}

export default SaveAttackHealModal;
