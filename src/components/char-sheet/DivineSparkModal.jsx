import { useState } from 'react';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';
import { applyHealingDirectly, logHealingToSSE } from '../../services/automation/common/healingRoll.js';
import { createSaveListener } from '../../services/automation/common/savePrompt.js';

function DivineSparkModal({ featureName, attackerName, targetName, campaignName, healExpression, damageExpression, damageTypes, saveType, wisModifier, onClose }) {
    const [mode, setMode] = useState(null);
    const [damageType, setDamageType] = useState(damageTypes[0] || 'Radiant');
    const [rolling, setRolling] = useState(false);
    const [result, setResult] = useState(null);

    const handleHeal = () => {
        setRolling(true);
        setMode('heal');

        const rollResult = rollExpression(healExpression);
        if (!rollResult) {
            setRolling(false);
            return;
        }

        const healAmount = rollResult.total;
        const { newHp, maxHp, actualHeal } = applyHealingDirectly(
            { name: targetName },
            targetName,
            healAmount,
            campaignName
        );

        logHealingToSSE(campaignName, {
            targetName,
            sourceName: featureName,
            actualHeal,
            newHp,
            maxHp,
        });

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

    const handleHarm = () => {
        setRolling(true);
        setMode('harm');

        if (damageTypes.length > 1 && !damageType) {
            setRolling(false);
            return;
        }

        const rollResult = rollExpression(damageExpression);
        if (!rollResult) {
            setRolling(false);
            return;
        }

        const damageAmount = rollResult.total;
        const saveDc = 8 + wisModifier + 2;

        const { promptId } = createSaveListener(campaignName, {
            targetName,
            saveType,
            saveDc,
        });

        const handleSaveResult = (event) => {
            if (event.detail.promptId !== promptId) return;
            window.removeEventListener('save-result', handleSaveResult);

            const success = event.detail.success;

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
                timestamp: Date.now(),
            }).catch(() => {});

            setResult({
                type: 'harm',
                formula: damageExpression + ' ' + damageType,
                rolls: rollResult.rolls,
                total: damageAmount,
                targetName,
                damageType: damageType || 'Radiant',
                saveSuccess: success,
                saveDc,
                saveType,
            });
            setRolling(false);
        };

        window.addEventListener('save-result', handleSaveResult);

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: attackerName,
            abilityName: featureName,
            description: `${featureName} (Harm) — targeting ${targetName}, ${damageType} damage, ${saveType} save DC ${saveDc}.`,
        }).catch(() => {});
    };

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-star-of-life"></i> {featureName}
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

                    {result && result.type === 'heal' && (
                        <>
                            <p><strong>{targetName}</strong> healed for <strong>{result.total}</strong> HP.</p>
                            <p className="sp-note">Roll: {result.formula} = {result.total}</p>
                            <p className="sp-note">Current HP: {result.newHp} / {result.maxHp} (healed {result.actualHeal})</p>
                        </>
                    )}

                    {result && result.type === 'harm' && (
                        <>
                            <p><strong>{targetName}</strong> — {result.saveType} save (DC {result.saveDc}): {result.saveSuccess ? 'Success' : 'Failed'}</p>
                            {result.saveSuccess ? (
                                <p className="sp-note">Target saved and takes no damage.</p>
                            ) : (
                                <p><strong>{targetName}</strong> takes <strong>{result.total}</strong> {result.damageType} damage.</p>
                            )}
                            <p className="sp-note">Damage roll: {result.formula} = {result.total}</p>
                        </>
                    )}
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
