import React, { useState, useCallback } from 'react';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt, sendSaveResult } from '../../../../services/combat/conditions/savePromptService.js';
import { rollExpression } from '../../../../services/dice/diceRoller.js';
import { addEntry } from '../../../../services/ui/logService.js';
import utils from '../../../../services/ui/utils.js';
import { logHealingToSSE } from '../../../../services/automation/common/healingRoll.js';
import { applyHealingToTarget } from '../../../../services/rules/combat/applyHealing.js';
import { applyDamageToTarget, computeDamageAfterEvasion, hasEvasionForSave, normalizeSaveType } from '../../../../services/rules/combat/applyDamage.js';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';
import { renderTargetList, logSaveEntry, persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';

function computeHealEvasionDamage(combatSummary, targetName, rawDamage, success, saveType) {
    const targetChar = (combatSummary.creatures?.filter(c => c.type === 'player') || []).find(c => c.name === targetName);
    const evasionEffects = targetChar?.computedStats?.evasionEffects;
    const evasionActive = hasEvasionForSave(evasionEffects, normalizeSaveType(saveType));
    return computeDamageAfterEvasion(rawDamage, success, 'half', evasionActive);
}

function applyAndLogHealNpcDamage({ combatSummary, campaignName, featureName, attackerName, saveDc, saveType, damageExpression, damageType, characters, targetName, success, saveRollTotal, saveBonus, rawDamage, finalDamage, damageRoll }) {
    if (finalDamage <= 0) return;
    const applyResult = applyDamageToTarget(combatSummary, targetName, finalDamage, [damageType], { campaignName, characters: characters, ignoreResistance: false, attackerName: attackerName, suppressHpLog: false });

    addEntry(campaignName, {
        type: 'roll', characterName: attackerName, rollType: 'save-damage',
        name: featureName, formula: damageExpression,
        rolls: damageRoll?.rolls ?? [], total: rawDamage, modifier: damageRoll?.modifier ?? 0,
        damageType, targetName, saveType, saveDc, dcSuccess: 'half',
        saveResult: success ? 'success' : 'failure',
        saveRoll: saveRollTotal, saveBonus,
        saveRawRolls: [saveRollTotal, saveRollTotal],
        finalDamage: applyResult?.finalDamage ?? finalDamage,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[SaveAttackHealModal] Error logging damage:', e); });
}

function resolveHealNpcTarget({ combatSummary, campaignName, featureName, attackerName, saveDc, saveType, damageExpression, damageType, characters, targetName, saveBonus }) {
    const saveRoll = rollExpression('1d20');
    const saveRollTotal = saveRoll?.total ?? 0;
    const saveTotal = saveRollTotal + saveBonus;
    const success = saveTotal >= saveDc;

    const damageRoll = rollExpression(damageExpression);
    const rawDamage = damageRoll?.total ?? 0;

    const finalDamage = computeHealEvasionDamage(combatSummary, targetName, rawDamage, success, saveType);

    sendSaveResult(campaignName, targetName, {
        promptId: utils.guid(),
        success,
        roll: saveRollTotal,
        total: saveTotal,
        saveBonus,
        rawRolls: [saveRollTotal, saveRollTotal],
    });

    logSaveEntry({ campaignName, featureName, attackerName, targetName, saveDc, saveType, success, total: saveTotal, rolls: [saveRollTotal], bonus: saveBonus, formula: `1d20${saveBonus !== 0 ? '+' + saveBonus : ''}` });

    applyAndLogHealNpcDamage({ combatSummary, campaignName, featureName, attackerName, saveDc, saveType, damageExpression, damageType, characters, targetName, success, saveRollTotal, saveBonus, rawDamage, finalDamage, damageRoll });

    return { targetName, success, roll: saveRollTotal, total: saveTotal, saveBonus, rawDamage, finalDamage };
}

function buildHealLastAttackPayload({ attackerName, damageExpression, damageType, featureName, saveDc, saveType, targets, lastNpcResult }) {
    return {
        attackerName,
        targetName: lastNpcResult.targetName,
        d20: lastNpcResult.roll,
        d20Rolls: [lastNpcResult.roll],
        bonus: 0,
        total: lastNpcResult.total,
        rollType: 'attack',
        saveType: saveType || null,
        saveDc: saveDc,
        saveResult: lastNpcResult.success ? 'success' : 'failure',
        damageFormula: damageExpression || null,
        damageName: featureName || null,
        damageType: damageType || null,
        rawDamage: lastNpcResult.rawDamage || 0,
        primaryDamage: lastNpcResult.rawDamage || 0,
        primaryDamageType: damageType || null,
        actualDamage: lastNpcResult.finalDamage || 0,
        damageApplied: lastNpcResult.finalDamage > 0,
        affectedTargets: targets,
        timestamp: Date.now(),
    };
}

function rollAndComputeSaveDamage(combatSummary, targetName, damageExpression, success, saveType) {
    const damageRoll = rollExpression(damageExpression);
    const rawDamage = damageRoll?.total ?? 0;
    // Same evasion-aware 'half' adjudication as the NPC lane at :46 —
    // success pays floor(raw/2) (0 under active Evasion), failure pays full.
    const finalDamage = computeHealEvasionDamage(combatSummary, targetName, rawDamage, success, saveType);
    return { damageRoll, rawDamage, finalDamage };
}

// fix#156: adjudicated save damage applies on BOTH outcomes. Every disk row routed
// here through saveAttackHandler grants half on a successful save ("Land's Aid",
// 2024/classes.json: half damage on a successful CON save) — half must land, not
// just display. Mirrors this file's NPC lane (applyAndLogHealNpcDamage applies any
// finalDamage > 0) and SaveAttackAoeModal's prompt lane (:1775 applyPlayerSaveDamage).
function applyAndLogSaveDamage({ campaignName, attackerName, featureName, damageExpression, damageType, targetName, saveType, saveDc, saveRoll, saveBonus, success, damageRoll, rawDamage, finalDamage, combatSummary }) {
    if (finalDamage <= 0) return;
    const characters = combatSummary?.creatures?.filter(c => c.type === 'player') || [];
    const applyResult = applyDamageToTarget(combatSummary, targetName, finalDamage, [damageType], { campaignName, characters: characters, ignoreResistance: false, attackerName: attackerName, suppressHpLog: false });
    addEntry(campaignName, {
        type: 'roll', characterName: attackerName, rollType: 'save-damage',
        name: featureName, formula: damageExpression,
        rolls: damageRoll?.rolls ?? [], total: rawDamage, modifier: damageRoll?.modifier ?? 0,
        damageType, targetName, saveType, saveDc, dcSuccess: 'half',
        saveResult: success ? 'success' : 'failure',
        saveRoll, saveBonus,
        saveRawRolls: [saveRoll, saveRoll],
        finalDamage: applyResult?.finalDamage ?? finalDamage,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[SaveAttackHealModal] Error logging player damage:', e); });
}

function buildSaveAttackPayload({ attackerName, targetName, detail, success, saveType, saveDc, damageExpression, featureName, damageType, rawDamage, finalDamage }) {
    return {
        attackerName,
        targetName,
        d20: detail.roll ?? 0,
        d20Rolls: [detail.roll ?? 0],
        bonus: detail.saveBonus ?? 0,
        total: detail.total ?? 0,
        rollType: 'attack',
        saveType: saveType || null,
        saveDc: saveDc,
        saveResult: success ? 'success' : 'failure',
        damageFormula: damageExpression || null,
        damageName: featureName || null,
        damageType: damageType || null,
        rawDamage: rawDamage || 0,
        primaryDamage: rawDamage || 0,
        primaryDamageType: damageType || null,
        actualDamage: finalDamage || 0,
        damageApplied: finalDamage > 0,
        timestamp: Date.now(),
    };
}

function SaveAttackHealModal({ combatSummary, attackerName, attackerPos, saveDc, campaignName, mapData, featureName, saveType, rangeFeet, damageExpression, damageType, healExpression, onClose, shape, attackerGridX, attackerGridY }) {
    const [healedTarget, setHealedTarget] = useState(null);
    const [healResult, setHealResult] = useState(null);

    const resolveAllSavesAndDamage = useCallback(async (targets) => {
        const results = [];
        const prompts = [];
        const characters = combatSummary?.creatures?.filter(c => c.type === 'player') || [];
        let lastNpcResult = null;

        for (const targetName of targets) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            const isNpc = !target || target.type === 'npc';
            const saveBonus = target?.saveBonuses?.[normalizeSaveType(saveType).toLowerCase()] ?? 0;

            if (isNpc) {
                lastNpcResult = resolveHealNpcTarget({ combatSummary, campaignName, featureName, attackerName, saveDc, saveType, damageExpression, damageType, characters, targetName, saveBonus });
                results.push(lastNpcResult);
            } else {
                const promptId = utils.guid();
                sendSavePrompt(campaignName, { promptId, targetName, saveType, saveDc, sourceName: attackerName });
                prompts.push({ promptId, targetName });
            }
        }

        if (lastNpcResult) {
            await setRuntimeValue('campaign', 'lastAttack', buildHealLastAttackPayload({ attackerName, damageExpression, damageType, featureName, saveDc, saveType, targets, lastNpcResult }), campaignName);
        }

        return { results, prompts };
    }, [combatSummary, campaignName, damageExpression, damageType, featureName, attackerName, saveDc, saveType]);

    const handleApplyOverride = useCallback(async (ctx) => {
        if (ctx.selected.size === 0) return;
        ctx.setProcessing(true);

        addEntry(campaignName, {
            type: 'ability_use', characterName: attackerName, abilityName: featureName,
            description: `${featureName}: Selecting ${ctx.selected.size} target(s) for save (DC ${saveDc} ${saveType})`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[SaveAttackHealModal] Error logging feature use:', e); });

        const { results, prompts } = await resolveAllSavesAndDamage(Array.from(ctx.selected));
        persistAndNotify(ctx.combatSummary, campaignName);
        ctx.setResults(results);
        ctx.setPendingPrompts(prompts);
    }, [campaignName, attackerName, saveDc, saveType, featureName, resolveAllSavesAndDamage]);

    const handleSaveResultOverride = useCallback(async (event, ctx) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = ctx.pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const targetName = ctx.pendingPrompts[pendingIndex].targetName;
        const success = detail.success;
        // Normalize the prompt answer once (server may omit roll/total/saveBonus).
        const saveRoll = detail.roll ?? 0;
        const saveTotal = detail.total ?? 0;
        const saveBonus = detail.saveBonus ?? 0;

        logSaveEntry({ campaignName, featureName, attackerName, targetName, saveDc, saveType, success, total: saveTotal, rolls: [saveRoll], bonus: saveBonus, formula: `1d20${saveBonus !== 0 ? '+' + saveBonus : ''}` });

        const { damageRoll, rawDamage, finalDamage } = rollAndComputeSaveDamage(combatSummary, targetName, damageExpression, success, saveType);
        applyAndLogSaveDamage({ campaignName, attackerName, featureName, damageExpression, damageType, targetName, saveType, saveDc, saveRoll, saveBonus, success, damageRoll, rawDamage, finalDamage, combatSummary });

        await setRuntimeValue('campaign', 'lastAttack', buildSaveAttackPayload({ attackerName, targetName, detail, success, saveType, saveDc, damageExpression, featureName, damageType, rawDamage, finalDamage }), campaignName);

        persistAndNotify(ctx.combatSummary, campaignName);
        ctx.setResults(prev => [...prev, {
            targetName, success, roll: saveRoll, total: saveTotal,
            saveBonus, rawDamage, finalDamage,
        }]);
        ctx.setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));
    }, [campaignName, attackerName, saveDc, featureName, saveType, damageExpression, damageType, combatSummary]);

    const handleHeal = useCallback((ctx) => {
        if (!healedTarget) return;
        ctx.setProcessing(true);

        const rollResult = rollExpression(healExpression);
        if (!rollResult) { ctx.setProcessing(false); return; }

        const healAmount = rollResult.total;
        // Canonical HP source: combatSummary.currentHp for monsters, runtime currentHitPoints for players (modifyHitPoints)
        const healResultObj = applyHealingToTarget(ctx.combatSummary, healedTarget, healAmount, campaignName);
        if (!healResultObj) { ctx.setProcessing(false); return; }
        const { newHp, actualHeal } = healResultObj;
        const targetCreature = ctx.combatSummary?.creatures?.find(c => c.name === healedTarget);
        const maxHp = healResultObj.maxHp ?? targetCreature?.maxHp ?? newHp;

        persistAndNotify(ctx.combatSummary, campaignName);

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
                                ? r.finalDamage > 0
                                    ? `Saved — takes ${r.finalDamage} ${damageType} damage (rolled ${r.rawDamage}, halved)`
                                    : `Saved — takes no damage (rolled ${r.rawDamage})`
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
