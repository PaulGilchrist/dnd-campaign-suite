import React, { useState, useCallback, useEffect } from 'react';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { logSaveResultEntry } from './saveResultLogging.js';
import {
    applyCalmEmotionsImmunity,
    applyCalmEmotionsIndifferent,
    resolveCalmEmotionsEligibility,
    logCalmEmotionsEligibility,
    registerCalmEmotionsExpiration,
} from '../../../../services/automation/handlers/spells/calmEmotionsHandler.js';
import {
    useCarefulSpellSelection,
    useSaveResultListener,
    useCarefulEligibleTargets,
    rollNpcSave,
    issuePlayerSavePrompt,
    logAbilityUseSelection,
    dropPendingPrompt,
} from './AreaEffectSaveFlow.utils.js';

async function resolveCalmNpcSave(ctx, targetName, target) {
    const { campaignName, casterName, saveType, saveDc, isCarefulSpell, isCarefulAlly, choice } = ctx;
    const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);
    const { saveBonus, saveRoll, saveTotal, success } = rollNpcSave(target, saveType, saveDc, ctx.heightenTarget === targetName);

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
        await addTargetResult(campaignName, {
            targetName,
            saveResult: 'success',
            roll: saveRoll,
            total: saveTotal,
            conditions: [],
            appliedDamage: 0,
        });
        return { targetName, success: true, roll: saveRoll, total: saveTotal, saveBonus, conditionApplied: false };
    }

    // SP-020 B6: NPC saves must appear in the log on both lanes.
    await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success, detail: { roll: saveRoll, total: saveTotal, saveBonus }, logPrefix: '[calmEmotions]' });

    if (!success) {
        if (choice === 'indifferent') {
            await applyCalmEmotionsIndifferent({ targetName, casterName, campaignName, dc: saveDc });
        } else {
            await applyCalmEmotionsImmunity({ targetName, casterName, campaignName, dc: saveDc });
        }
        await addTargetResult(campaignName, {
            targetName,
            saveResult: 'failure',
            roll: saveRoll,
            total: saveTotal,
            conditions: [],
            appliedDamage: 0,
        });
        return { targetName, success: false, roll: saveRoll, total: saveTotal, saveBonus, conditionApplied: true, choice };
    }
    return { targetName, success: true, roll: saveRoll, total: saveTotal, saveBonus, conditionApplied: false };
}

async function resolveCalmPlayerSave(ctx, targetName, results, prompts) {
    const { campaignName, casterName, saveType, saveDc, isCarefulSpell, isCarefulAlly, choice } = ctx;
    if (isCarefulSpell && isCarefulAlly(targetName)) {
        results.push({ targetName, success: true, roll: null, total: 0, saveBonus: 0, conditionApplied: false });
        return;
    }
    // SP-020 B1: every target (players included) rolls before any effect.
    prompts.push({ ...issuePlayerSavePrompt(campaignName, { targetName, saveType, saveDc, casterName }), choice });
}

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
    // SP-020 B7: inclusion is tracked separately from the effect choice so a
    // single click flips it (the old code conflated the two maps).
    const [excludedTargets, setExcludedTargets] = useState({});
    // SP-020 B2/B4: Humanoid-only + sphere gate, resolved async.
    const [gate, setGate] = useState({ ready: false, eligible: [], ineligible: [], advisory: [] });

    const { isCarefulSpell, isCarefulAlly } = useCarefulSpellSelection(metamagicCareful, playerStats.name);

    const combatSummary = getCombatSummary(campaignName);
    const isOverlayTargeted = playerStats.targetName?.startsWith('overlay-');

    const eligibleTargets = useCarefulEligibleTargets(combatSummary, isCarefulSpell, isCarefulAlly);

    useEffect(() => {
        const defaultChoices = {};
        for (const c of eligibleTargets) {
            if (!(c.name in targetChoices)) defaultChoices[c.name] = 'immunity';
        }
        if (Object.keys(defaultChoices).length > 0) {
            setTargetChoices(prev => ({ ...prev, ...defaultChoices }));
        }
    }, [eligibleTargets, targetChoices]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await resolveCalmEmotionsEligibility({
                campaignName,
                casterName: playerStats.name,
                creatures: combatSummary?.creatures || [],
            });
            if (!cancelled) setGate({ ready: true, ...res });
        })();
        return () => { cancelled = true; };
    }, [campaignName, playerStats.name, combatSummary]);

    const resolveAllSaves = useCallback(async (selectedNames) => {
        const casterName = playerStats.name;

        storeSpellLastAttack(campaignName, {
            casterName,
            spellName: action.name,
            saveType,
            saveDc,
            attackScope: 'aoe',
        });

        // SP-020 B2/B4: record who cannot be affected + geometry advisories.
        await logCalmEmotionsEligibility({ campaignName, casterName, ineligible: gate.ineligible, advisory: gate.advisory });

        // SP-020 B5: 1-minute concentration duration clock (10 rounds).
        registerCalmEmotionsExpiration({ casterName, campaignName });

        const results = [];
        const prompts = [];

        const saveCtx = { campaignName, casterName, saveType, saveDc, isCarefulSpell, isCarefulAlly, heightenTarget };

        for (const targetName of selectedNames) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            if (!target) continue;

            const choice = targetChoices[targetName] === 'indifferent' ? 'indifferent' : 'immunity';
            const ctx = { ...saveCtx, choice };

            // SP-020 B1: everyone saves first — effects only on a failed save.
            if (target.type === 'npc') {
                results.push(await resolveCalmNpcSave(ctx, targetName, target));
            } else {
                // Player — send save prompt
                await resolveCalmPlayerSave(ctx, targetName, results, prompts);
            }
        }

        persistAndNotify(getCombatSummary(campaignName), campaignName);

        return { results, prompts };
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, isCarefulSpell, isCarefulAlly, heightenTarget, targetChoices, combatSummary, gate]);

    const handleSaveResult = useCallback(async (event) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const { targetName, choice } = pendingPrompts[pendingIndex];
        const success = detail.success;
        const casterName = playerStats.name;

        if (!success) {
            // SP-020 B3: failure grants immunity or registered advisory
            // indifference — never the Charmed condition.
            if (choice === 'indifferent') {
                await applyCalmEmotionsIndifferent({ targetName, casterName, campaignName, dc: saveDc });
            } else {
                await applyCalmEmotionsImmunity({ targetName, casterName, campaignName, dc: saveDc });
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

        dropPendingPrompt(setPendingPrompts, detail.promptId, onClose);
    }, [campaignName, saveDc, saveType, pendingPrompts, playerStats.name, onClose]);

    const handleCreatureSelectionConfirm = useCallback(async (selectedNames) => {
        await logAbilityUseSelection(campaignName, { casterName: playerStats.name, abilityName: action.name, targetCount: selectedNames.length, saveDc, saveType, logPrefix: '[calmEmotions]' });

        const { prompts } = await resolveAllSaves(selectedNames);
        setPendingPrompts(prompts);
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSaves]);

    useSaveResultListener(pendingPrompts, handleSaveResult);

    const handleToggleTarget = useCallback((targetName) => {
        setExcludedTargets(prev => ({ ...prev, [targetName]: !prev[targetName] }));
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

    const displayedTargets = gate.ready
        ? eligibleTargets.filter(c => gate.eligible.includes(c.name))
        : eligibleTargets;
    const includedTargets = displayedTargets.filter(c => !excludedTargets[c.name]);

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-hand-holding-heart"></i> Calm Emotions
                </div>
                <div className="sp-body">
                    <p>Select <strong>Humanoid</strong> creatures in the <strong>20-foot-radius sphere</strong>. Each must make a <strong>{saveType}</strong> saving throw (DC {saveDc}).</p>
                    <p className="sp-note">On a failed save, choose the effect for each creature. Indifference is a GM-enforced attitude (it ends if the target takes damage or witnesses an ally take damage).</p>
                    <div className="secondary-target-list">
                        {displayedTargets.map((target) => {
                            const name = target.name;
                            const isIncluded = !excludedTargets[name];
                            const choice = targetChoices[name] === 'indifferent' ? 'indifferent' : 'immunity';
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
                                                    checked={choice === 'indifferent'}
                                                    onChange={() => handleToggleChoice(name, 'indifferent')}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                                Become Indifferent
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
                        {displayedTargets.length === 0 && (
                            <p className="sp-note">No Humanoid targets available in the sphere.</p>
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
