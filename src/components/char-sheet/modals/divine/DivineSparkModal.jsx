import { useRef, useState } from 'react';
import { rollExpression, rollExpressionMaximized } from '../../../../services/dice/diceRoller.js';
import { hasHealingMaximization } from '../../../../services/combat/automation/automationService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { logHealingToSSE } from '../../../../services/automation/common/healingRoll.js';
import { createSaveListener } from '../../../../services/automation/common/savePrompt.js';
import { getCoronaSaveDisadvantage } from '../../../../services/combat/auras/coronaAuraUtils.js';
import { applyHealingToTarget } from '../../../../services/rules/combat/applyHealing.js';
import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { getCombatContext } from '../../../../services/rules/combat/damageUtils.js';
import { isWithinRange } from '../../../../services/rules/combat/rangeCheck.js';

function resolveSparkSaveDc(playerStats, wisModifier) {
    // CLA-092: caster's real spell save DC — never a hardcoded +2 proficiency.
    return playerStats?.spellAbilities?.saveDc ?? (8 + wisModifier + (playerStats?.proficiency ?? 2));
}

async function applyHarmDamage({ campaignName, attackerName, targetName, damageAmount, damageType }) {
    const cs = await getCombatContext(campaignName);
    const characters = cs?.creatures?.filter(c => c.type === 'player') || [];
    const applyResult = await applyDamageToTarget(cs, targetName, damageAmount, [damageType], { campaignName, characters, ignoreResistance: false, attackerName });
    if (!applyResult) {
        console.error('[DivineSparkModal] applyDamageToTarget returned null for', targetName);
        return 0;
    }
    return applyResult.finalDamage ?? 0;
}

function DivineSparkResultView({ result, targetName }) {
    if (!result) return null;
    if (result.type === 'heal') {
        return (
            <>
                <p><strong>{targetName}</strong> healed for <strong>{result.total}</strong> HP.</p>
                <p className="sp-note">Roll: {result.formula} = {result.total}{result.maximized ? ' (Maximized)' : ''}</p>
                <p className="sp-note">Current HP: {result.newHp} / {result.maxHp} (healed {result.actualHeal})</p>
            </>
        );
    }
    if (result.type === 'refused') {
        return <p className="sp-note">{result.reason}</p>;
    }
    if (result.type === 'harm') {
        return (
            <>
                <p><strong>{targetName}</strong> — {result.saveType} save (DC {result.saveDc}): {result.saveSuccess ? 'Success' : 'Failed'}</p>
                {result.saveSuccess ? (
                    <p className="sp-note">Target saved and takes no damage.</p>
                ) : (
                    <p><strong>{targetName}</strong> takes <strong>{result.finalDamage}</strong> {result.damageType} damage.</p>
                )}
                <p className="sp-note">Damage roll: {result.formula} = {result.total}</p>
            </>
        );
    }
    return null;
}

function DivineSparkModal({ featureName, attackerName, targetName, campaignName, healExpression, damageExpression, damageTypes, saveType, wisModifier, channelDivinityCharges, playerStats, onClose }) {
    const [mode, setMode] = useState(null);
    const [damageType, setDamageType] = useState(damageTypes[0] || 'Radiant');
    const [rolling, setRolling] = useState(false);
    const [result, setResult] = useState(null);
    // Pay-at-CONFIRM (2026-11-05, playbook §166 SetConditionModal pattern): the
    // Channel Divinity charge + ability_use spend log used to happen at
    // row-click in divineSparkHandler — Cancel and out-of-range refusals kept
    // the paid charge (§9 leak family). Both now move atomically to the branch
    // confirm, after its gates pass; the ref guard pins exactly ONE spend per
    // modal session even if a branch aborts and a second branch is clicked.
    const chargeSpentRef = useRef(false);

    const spendCharge = (description) => {
        if (chargeSpentRef.current) return;
        chargeSpentRef.current = true;
        if (typeof channelDivinityCharges === 'number') {
            // Mirrors SetConditionModal.handleApplyOverride: decrement written
            // straight to the runtime store (absent key → initialized to
            // pool-max − 1, since the payload carries max when stored is null).
            setRuntimeValue(attackerName, 'channelDivinityCharges', channelDivinityCharges - 1, campaignName);
        }
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: attackerName,
            abilityName: featureName,
            description,
        }).catch((e) => { console.error("[divineSparkModal:log-error]", e); });
    };

    // Spend-row copy mirrors SetConditionModal: branch detail + honest
    // remaining-charge tail.
    const chargeDescription = (branch, detail) => {
        const base = `${featureName} (${branch}) — targeting ${targetName}, ${detail}.`;
        return typeof channelDivinityCharges === 'number'
            ? `${base} Channel Divinity: ${channelDivinityCharges - 1} remaining.`
            : base;
    };

    const refuse = (reason) => {
        addEntry(campaignName, {
            type: 'automation',
            characterName: attackerName,
            abilityName: featureName,
            automationType: 'divine_spark',
            automationDetail: 'divine_spark_refused',
            reason,
            description: `${featureName} refused — ${reason}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[divineSparkModal:refusal-log-error]', e); });
        setResult({ type: 'refused', reason });
        setRolling(false);
    };

    const handleHeal = async () => {
        setRolling(true);
        setMode('heal');

        const maximize = hasHealingMaximization(playerStats);
        const rollResult = maximize ? rollExpressionMaximized(healExpression) : rollExpression(healExpression);
        if (!rollResult) {
            setMode(null);
            setRolling(false);
            return;
        }

        const healAmount = rollResult.total;

        if (!await isWithinRange(attackerName, targetName, 30)) {
            refuse(`${targetName} is out of range for ${featureName} (30 ft).`);
            return;
        }

        // CLA-092: canonical heal choke point (modifyHitPoints) — resolves the
        // TARGET's max HP (runtime hitPoints for PCs, combatSummary maxHp for
        // monsters) and clamps; the fake-playerStats lane wrote NaN.
        const cs = await getCombatContext(campaignName);
        const healResultObj = applyHealingToTarget(cs, targetName, healAmount, campaignName);
        if (!healResultObj) {
            console.error('[DivineSparkModal] applyHealingToTarget returned null for', targetName);
            refuse(`${targetName} was not found in combat — no healing applied.`);
            return;
        }

        const { newHp, maxHp, actualHeal } = healResultObj;

        logHealingToSSE(campaignName, {
            targetName,
            sourceName: featureName,
            actualHeal,
            newHp,
            maxHp,
        });

        spendCharge(chargeDescription('Heal', `healed ${actualHeal} HP`));

        setResult({
            type: 'heal',
            formula: healExpression,
            rolls: rollResult.rolls,
            total: healAmount,
            targetName,
            actualHeal,
            newHp,
            maxHp,
        });
        setRolling(false);
    };

    const handleHarm = async () => {
        setRolling(true);
        setMode('harm');

        if (damageTypes.length > 1 && !damageType) {
            setMode(null);
            setRolling(false);
            return;
        }

        const rollResult = rollExpression(damageExpression);
        if (!rollResult) {
            setMode(null);
            setRolling(false);
            return;
        }

        const damageAmount = rollResult.total;
        const saveDc = resolveSparkSaveDc(playerStats, wisModifier);

        if (!await isWithinRange(attackerName, targetName, 30)) {
            refuse(`${targetName} is out of range for ${featureName} (30 ft).`);
            return;
        }

        // CLA-063: Corona of Light — enemies in the bright light have
        // Disadvantage on saves vs Fire/Radiant; the prompt payload flag is
        // the machine-truth channel consumed by SavePromptModal getSaveDisadvantage.
        // 2026-11-04 range fix: awaited async lane — handleHarm is already
        // async (30 ft gate above), so the util measures the 60 ft aura when
        // both tokens are positioned on the active map, gridless-lenient otherwise.
        const coronaSaveDisadvantage = (await getCoronaSaveDisadvantage({
            targetName,
            damageType,
            campaignName,
        })).disadvantage || false;

        // CLA-092: damage transport on the prompt payload — createSaveListener
        // stamps damageFormula/damageType/rawDamage onto its save_result log.
        const { promptId } = createSaveListener(campaignName, {
            targetName,
            attackerName,
            saveType,
            saveDc,
            disadvantage: coronaSaveDisadvantage,
            sourceName: featureName,
            damageFormula: `${damageExpression} ${damageType}`,
            damageType,
            rawDamage: damageAmount,
        });

        const handleSaveResult = async (event) => {
            if (event.detail.promptId !== promptId) return;
            window.removeEventListener('save-result', handleSaveResult);
            window.removeEventListener('save-dismissed', handleSaveDismissed);

            const success = event.detail.success;

            // CLA-092: failed save applies the rolled damage through the
            // canonical damage resolver (typed, resistances, hp_change log).
            const finalDamage = success ? 0 : await applyHarmDamage({ campaignName, attackerName, targetName, damageAmount, damageType });

            addEntry(campaignName, {
                type: 'roll',
                name: featureName,
                characterName: attackerName,
                rollType: 'save-damage',
                targetName,
                saveDc,
                saveType,
                saveResult: success ? 'success' : 'failure',
                total: event.detail.total ?? 0,
                rolls: [event.detail.roll ?? 0],
                bonus: event.detail.saveBonus ?? 0,
                formula: `1d20${event.detail.saveBonus !== 0 ? '+' + event.detail.saveBonus : ''}`,
                damageFormula: `${damageExpression} ${damageType}`,
                damageType,
                rawDamage: damageAmount,
                finalDamage,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[DivineSparkModal] Error:", e); });

            setResult({
                type: 'harm',
                formula: damageExpression + ' ' + damageType,
                rolls: rollResult.rolls,
                total: damageAmount,
                finalDamage,
                targetName,
                damageType: damageType || 'Radiant',
                saveSuccess: success,
                saveDc,
                saveType,
            });
            setRolling(false);
        };

        window.addEventListener('save-result', handleSaveResult);

        // Dismiss-softlock fix (2026-11-05): a GM Dismiss on the un-rolled
        // prompt never dispatches save-result (dismiss doctrine — a dismissed
        // save never resolves), so this modal used to park at "Rolling…"
        // with zero buttons forever. The prompt queue broadcasts the
        // abandonment as `save-dismissed`; refuse() logs the
        // divine_spark_refused row and renders the result view with a
        // working Done.
        const handleSaveDismissed = (event) => {
            if (event.detail.promptId !== promptId) return;
            window.removeEventListener('save-dismissed', handleSaveDismissed);
            window.removeEventListener('save-result', handleSaveResult);
            refuse('save was dismissed — no damage dealt');
        };
        window.addEventListener('save-dismissed', handleSaveDismissed);

        // Pay-at-CONFIRM (replaces the old row-click spend + activation log):
        // every harm gate passed and the prompt is armed — write exactly one
        // charge decrement and its matching ability_use row together. A later
        // Dismiss keeps the charge spent (doctrine, playbook §5/§9).
        spendCharge(chargeDescription('Harm', `${damageType} damage, ${saveType} save DC ${saveDc}`));
    };

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-star-of-life"></i> {featureName}
                    {typeof channelDivinityCharges === 'number' && (
                        <span className="sp-resource-info">
                            {channelDivinityCharges} charge{channelDivinityCharges === 1 ? '' : 's'} remaining
                        </span>
                    )}
                </div>
                <div className="sp-body">
                    {!mode && !rolling && !result && (
                        <>
                            <p>Channel divine energy at <strong>{targetName}</strong>.</p>
                            <div className="sp-actions" style={{ flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                                <button className="sp-roll-btn" onClick={handleHeal} type="button">
                                    <i className="fa-solid fa-heart"></i> Heal ({healExpression})
                                </button>
                                {damageTypes.length > 1 && (
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
                                        {damageTypes.map(dt => (
                                            <label key={dt} style={{ cursor: 'pointer', padding: '4px 8px', border: damageType === dt ? '2px solid #e8b84b' : '1px solid #555', borderRadius: '4px' }}>
                                                <input
                                                    type="radio"
                                                    name="damageType"
                                                    value={dt}
                                                    checked={damageType === dt}
                                                    onChange={() => setDamageType(dt)}
                                                    style={{ marginRight: '4px' }}
                                                />
                                                {dt}
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <button className="sp-roll-btn" onClick={handleHarm} type="button" style={{ marginTop: '8px' }}>
                                    <i className="fa-solid fa-bolt"></i> Harm ({damageExpression} {damageType || damageTypes[0]}, {saveType} save)
                                </button>
                            </div>
                        </>
                    )}

                    {rolling && (
                        <p><i className="fa-solid fa-spinner fa-spin"></i> Rolling...</p>
                    )}

                    <DivineSparkResultView result={result} targetName={targetName} />
                </div>
                <div className="sp-actions">
                    {result ? (
                        <button className="sp-roll-btn" onClick={onClose} type="button">Done</button>
                    ) : !rolling && !mode ? (
                        <button className="sp-dismiss-btn" onClick={onClose} type="button">Cancel</button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default DivineSparkModal;
