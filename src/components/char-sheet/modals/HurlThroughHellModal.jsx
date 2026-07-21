import { useState } from 'react';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { rollExpression } from '../../../services/dice/diceRoller.js';

function HurlThroughHellModal({ action, playerStats, campaignName, targetName, saveType, saveDc, damageType, damageExpression, damageTotal, _dieRoll, currentUses, maxUses, pactSlotLevel, pactSlotsAvailable, pactMagicRecharge, onClose }) {
    const [step, setStep] = useState('info'); // 'info' | 'result'
    const [result, setResult] = useState(null);

    const playerName = playerStats.name;
    const featureName = action.name || 'Hurl Through Hell';
    const hasUse = currentUses < maxUses;
    const needsPactSlot = pactMagicRecharge && !hasUse && pactSlotLevel > 0 && pactSlotsAvailable;

    const handleCancel = () => {
        onClose();
    };

    const handleConfirm = async () => {
        setStep('result');

        // Mark as used this turn
        const currentTurn = getRuntimeValue(playerName, 'currentTurn', campaignName) || 'unknown';
        await setRuntimeValue(playerName, 'hurlThroughHellTurnUsed', currentTurn, campaignName);

        if (hasUse) {
            await setRuntimeValue(playerName, 'hurlThroughHellUses', currentUses + 1, campaignName);
        } else if (needsPactSlot) {
            const slotKey = `spell_slots_level_${pactSlotLevel}`;
            const currentSlots = Number(getRuntimeValue(playerName, slotKey, campaignName) ?? playerStats.spellAbilities?.[slotKey] ?? 0);
            await setRuntimeValue(playerName, slotKey, currentSlots - 1, campaignName);
            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: featureName,
                description: `${playerName} expended a Pact Magic spell slot (level ${pactSlotLevel}) to restore a use of ${featureName}.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[hurlThroughHell] Error:", e); });
        }

        // Resolve damage
        const actualDieRoll = rollExpression(damageExpression);
        const actualDamageTotal = actualDieRoll?.total || damageTotal;

        // Create save listener
        const { promptId } = createSaveListener(campaignName, {
            targetName,
            attackerName: playerName,
            saveType,
            saveDc,
        });

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${featureName} triggered — ${targetName} must make ${saveType} save (DC ${saveDc}) or be hurled through the lower planes.`,
            targetName,
            promptId,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[hurlThroughHell] Error:", e); });

        const handleSaveResult = async (event) => {
            if (event.detail.promptId !== promptId) return;

            const saveRoll = event.detail.roll;
            const saveTotal = event.detail.total;
            const saveSuccess = event.detail.success;

            if (!saveSuccess) {
                const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
                const newConds = Array.isArray(storedConds) ? [...storedConds, 'incapacitated'] : ['incapacitated'];
                setRuntimeValue(targetName, 'activeConditions', newConds, campaignName);

                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                storedEffects.push({
                    target: targetName,
                    source: featureName,
                    effect: 'incapacitated',
                    condition: 'incapacitated',
                    duration: 'until_end_of_next_turn',
                    saveType,
                    saveDc,
                    teleport: true,
                    returnToSpace: true,
                });
                setRuntimeValue(campaignName, 'targetEffects', storedEffects, campaignName);

                const combatSummary = getCombatSummary(campaignName);
                const targetCreature = combatSummary?.creatures?.find(c => c.name === targetName);
                const isFiend = targetCreature?.type === 'fiend';

                let actualDamage = 0;

                if (!isFiend) {
                    const characters = (combatSummary?.creatures || []).filter(c => c.type === 'player');
                    const dmgResult = applyDamageToTarget(
                        combatSummary,
                        targetName,
                        actualDamageTotal,
                        [damageType],
                        campaignName,
                        characters,
                        false,
                        playerName
                    );
                    actualDamage = dmgResult?.finalDamage ?? actualDamageTotal;

                    await addEntry(campaignName, {
                        type: 'save_result',
                        characterName: playerName,
                        targetName,
                        saveDc,
                        saveType,
                        success: false,
                        saveRoll,
                        saveTotal,
                        description: `${targetName} failed ${saveType} save (rolled ${saveRoll} + ${saveTotal - saveRoll} = ${saveTotal} vs DC ${saveDc}) — hurled through the lower planes.`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error("[hurlThroughHell] Error:", e); });

                    await addEntry(campaignName, {
                        type: 'roll',
                        characterName: playerName,
                        rollType: 'damage',
                        name: 'Hurl Through Hell Damage',
                        targetName,
                        damageType: damageType,
                        formula: damageExpression,
                        rolls: actualDieRoll?.rolls,
                        total: actualDamage,
                        description: `${targetName} takes ${actualDamage} ${damageType} damage from Hurl Through Hell.`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error("[hurlThroughHell] Error:", e); });

                    window.dispatchEvent(new CustomEvent('damage-popup', {
                        detail: {
                            targetName,
                            sourceName: playerName,
                            spellName: featureName,
                            popupText: `${targetName} failed ${saveType} save — hurled through the lower planes and takes ${actualDamage} ${damageType} damage.`,
                            damageType,
                            rolls: actualDieRoll?.rolls,
                            formula: damageExpression,
                        },
                    }));
                } else {
                    await addEntry(campaignName, {
                        type: 'save_result',
                        characterName: playerName,
                        targetName,
                        saveDc,
                        saveType,
                        success: false,
                        saveRoll,
                        saveTotal,
                        description: `${targetName} (Fiend) failed ${saveType} save (rolled ${saveRoll} + ${saveTotal - saveRoll} = ${saveTotal} vs DC ${saveDc}) — hurled through the lower planes but takes no Psychic damage.`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error("[hurlThroughHell] Error:", e); });

                    window.dispatchEvent(new CustomEvent('damage-popup', {
                        detail: {
                            targetName,
                            sourceName: playerName,
                            spellName: featureName,
                            popupText: `${targetName} (Fiend) failed ${saveType} save — hurled through the lower planes but takes no Psychic damage.`,
                            damageType,
                        },
                    }));
                }
            } else {
                await addEntry(campaignName, {
                    type: 'save_result',
                    characterName: playerName,
                    targetName,
                    saveDc,
                    saveType,
                    success: true,
                    saveRoll,
                    saveTotal,
                    description: `${targetName} succeeded on ${saveType} save (rolled ${saveRoll} + ${saveTotal - saveRoll} = ${saveTotal} vs DC ${saveDc}) — not hurled through the lower planes.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[hurlThroughHell] Error:", e); });

                window.dispatchEvent(new CustomEvent('damage-popup', {
                    detail: {
                        targetName,
                        sourceName: playerName,
                        spellName: featureName,
                        popupText: `${targetName} succeeded on ${saveType} save — resists the effect and is not hurled through the lower planes.`,
                        damageType,
                    },
                }));
            }

            window.removeEventListener('save-result', handleSaveResult);
            setResult({ saveSuccess, actualDamage: 0 });
        };

        window.addEventListener('save-result', handleSaveResult);
    };

    // Info screen — shows error message when can't use
    if (step === 'info') {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-dragon"></i> {featureName}
                    </div>
                    <div className="sp-body">
                        <p>Target: <b>{targetName}</b></p>
                        <p><b>Disappearance:</b> {targetName} disappears and hurtles through a nightmare landscape.</p>
                        <p><b>Save:</b> {targetName} must make a <b>{saveType}</b> saving throw (DC {saveDc}).</p>
                        <p><b>On a Failed Save:</b> {targetName} takes <b>{damageTotal} {damageType} damage</b> (if not a Fiend) and has the <b>Incapacitated</b> condition until the end of your next turn.</p>
                        <p><b>Return:</b> At the end of your next turn, {targetName} returns to the space it previously occupied, or the nearest unoccupied space.</p>
                        {hasUse ? (
                            <>
                                <p className="sp-note">Uses available: {maxUses - currentUses} / {maxUses} (Long Rest).</p>
                                <div className="sp-actions">
                                    <button className="sp-roll-btn" onClick={handleConfirm} type="button">
                                        <i className="fa-solid fa-dragon"></i> Hurl Through Hell
                                    </button>
                                    <button className="sp-dismiss-btn" onClick={handleCancel} type="button">Cancel</button>
                                </div>
                            </>
                        ) : needsPactSlot ? (
                            <>
                                <p className="sp-note">Cost: Expend a Pact Magic spell slot (level {pactSlotLevel}) to restore a use.</p>
                                <div className="sp-actions">
                                    <button className="sp-roll-btn" onClick={handleConfirm} type="button">
                                        <i className="fa-solid fa-dragon"></i> Hurl Through Hell
                                    </button>
                                    <button className="sp-dismiss-btn" onClick={handleCancel} type="button">Cancel</button>
                                </div>
                            </>
                        ) : (
                            <p className="sp-note" style={{ color: '#f87171' }}>
                                {pactMagicRecharge
                                    ? 'No uses remaining. Recharges on a Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.'
                                    : 'No uses remaining. Recharges on a Long Rest.'}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Result screen — shown after save resolves
    if (step === 'result' && result) {
        const { saveSuccess } = result;
        let description = '';

        if (!saveSuccess) {
            description = `${targetName} failed ${saveType} save — hurled through the lower planes.`;
        } else {
            description = `${targetName} succeeded on ${saveType} save — resists the effect and is not hurled through the lower planes.`;
        }

        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-dragon"></i> {featureName}
                    </div>
                    <div className="sp-body" dangerouslySetInnerHTML={{ __html: description }}>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

export default HurlThroughHellModal;
