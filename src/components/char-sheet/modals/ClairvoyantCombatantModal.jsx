import { useState } from 'react';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function ClairvoyantCombatantModal({ action, playerStats, campaignName, targetName, saveType, saveDc, currentUses, maxUses, pactSlotLevel, pactSlotsAvailable, pactMagicRecharge, onClose }) {
    const [step, setStep] = useState('info'); // 'info' | 'result'
    const [result, setResult] = useState(null);

    const playerName = playerStats.name;
    const featureName = action.name || 'Clairvoyant Combatant';
    const hasUse = currentUses < maxUses;
    const needsPactSlot = pactMagicRecharge && !hasUse && pactSlotLevel > 0 && pactSlotsAvailable;

    const handleCancel = () => {
        onClose();
    };

    const handleConfirm = async () => {
        setStep('result');

        // Spend a use or expend Pact Magic slot
        if (hasUse) {
            await setRuntimeValue(playerName, 'clairvoyantCombatantUses', currentUses + 1, campaignName);
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
            }).catch((e) => { console.error("[clairvoyantCombatant] Error:", e); });
        }

        // Set the combat advantage/disadvantage effects via targetEffects
        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const newEffect = {
            target: targetName,
            source: featureName,
            effect: 'clairvoyant_combatant',
            duration: '1_minute',
            saveType,
            saveDc,
            attackerAdvantage: true,
            defenderDisadvantage: true,
        };
        const updatedEffects = [...storedEffects, newEffect];
        setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

        // Store the active target for contextBuilder
        await setRuntimeValue(playerName, 'clairvoyantCombatantTarget', targetName, campaignName);

        // Also add to activeBuffs for ConditionEffectBadges to detect advantage
        const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(storedBuffs) ? storedBuffs : [];
        const newBuffs = [...activeBuffs, {
            name: featureName,
            effect: 'clairvoyant_combatant',
            duration: '1_minute',
            target: targetName,
        }];
        setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

        // Create save listener
        const { promptId } = createSaveListener(campaignName, {
            targetName,
            saveType,
            saveDc,
        });

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${featureName} triggered against ${targetName} (via Awakened Mind) — ${targetName} must make ${saveType} save (DC ${saveDc}) or suffer combat disadvantage.`,
            targetName,
            promptId,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[clairvoyantCombatant] Error:", e); });

        const handleSaveResult = async (event) => {
            if (event.detail.promptId !== promptId) return;

            const saveRoll = event.detail.roll;
            const saveTotal = event.detail.total;
            const saveSuccess = event.detail.success;

            if (!saveSuccess) {
                await addEntry(campaignName, {
                    type: 'save_result',
                    characterName: playerName,
                    targetName,
                    saveDc,
                    saveType,
                    success: false,
                    saveRoll,
                    saveTotal,
                    description: `${targetName} failed ${saveType} save (rolled ${saveRoll} + ${saveTotal - saveRoll} = ${saveTotal} vs DC ${saveDc}) — Clairvoyant Combatant active. ${targetName} has Disadvantage on attacks against you, you have Advantage on attacks against ${targetName}.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[clairvoyantCombatant] Error:", e); });
            } else {
                // Target succeeded — remove the effects
                const filteredEffects = (getRuntimeValue(campaignName, 'targetEffects', campaignName) || []).filter(
                    e => !(e.target === targetName && e.source === featureName && e.effect === 'clairvoyant_combatant')
                );
                setRuntimeValue(campaignName, 'targetEffects', filteredEffects, campaignName);

                // Clear the active target
                await setRuntimeValue(playerName, 'clairvoyantCombatantTarget', null, campaignName);

                // Remove from activeBuffs
                const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
                const buffs = Array.isArray(storedBuffs) ? storedBuffs : [];
                const filteredBuffs = buffs.filter(b => !(b.effect === 'clairvoyant_combatant' && b.target === targetName));
                setRuntimeValue(playerName, 'activeBuffs', filteredBuffs, campaignName);

                await addEntry(campaignName, {
                    type: 'save_result',
                    characterName: playerName,
                    targetName,
                    saveDc,
                    saveType,
                    success: true,
                    saveRoll,
                    saveTotal,
                    description: `${targetName} succeeded on ${saveType} save (rolled ${saveRoll} + ${saveTotal - saveRoll} = ${saveTotal} vs DC ${saveDc}) — Clairvoyant Combatant has no effect.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[clairvoyantCombatant] Error:", e); });
            }

            window.removeEventListener('save-result', handleSaveResult);
            setResult({ saveSuccess });
        };

        window.addEventListener('save-result', handleSaveResult);
    };

    // Info screen — shows error message when can't use
    if (step === 'info') {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-eye"></i> {featureName}
                    </div>
                    <div className="sp-body">
                        <p>Target: <b>{targetName}</b> (via Awakened Mind)</p>
                        <p><b>Save:</b> {targetName} must make a <b>{saveType}</b> saving throw (DC {saveDc}).</p>
                        <p><b>On a Failed Save:</b> {targetName} has <b>Disadvantage on attack rolls against you</b>, and <b>you have Advantage on attack rolls against {targetName}</b> for the duration.</p>
                        {hasUse ? (
                            <>
                                <p className="sp-note">Uses available: {maxUses - currentUses} / {maxUses} (Short or Long Rest).</p>
                                <div className="sp-actions">
                                    <button className="sp-roll-btn" onClick={handleConfirm} type="button">
                                        <i className="fa-solid fa-eye"></i> Clairvoyant Combatant
                                    </button>
                                    <button className="sp-dismiss-btn" onClick={handleCancel} type="button">Cancel</button>
                                </div>
                            </>
                        ) : needsPactSlot ? (
                            <>
                                <p className="sp-note">Cost: Expend a Pact Magic spell slot (level {pactSlotLevel}) to restore a use.</p>
                                <div className="sp-actions">
                                    <button className="sp-roll-btn" onClick={handleConfirm} type="button">
                                        <i className="fa-solid fa-eye"></i> Clairvoyant Combatant
                                    </button>
                                    <button className="sp-dismiss-btn" onClick={handleCancel} type="button">Cancel</button>
                                </div>
                            </>
                        ) : (
                            <p className="sp-note" style={{ color: '#f87171' }}>
                                {pactMagicRecharge
                                    ? 'No uses remaining. Recharges on a Short or Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.'
                                    : 'No uses remaining. Recharges on a Short or Long Rest.'}
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
            description = `${targetName} failed ${saveType} save — Clairvoyant Combatant active. ${targetName} has Disadvantage on attacks against you, you have Advantage on attacks against ${targetName}.`;
        } else {
            description = `${targetName} succeeded on ${saveType} save — Clairvoyant Combatant has no effect.`;
        }

        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-eye"></i> {featureName}
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

export default ClairvoyantCombatantModal;
