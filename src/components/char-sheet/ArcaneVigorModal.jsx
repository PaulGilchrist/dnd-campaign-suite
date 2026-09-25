import React, { useState } from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { rollDice } from '../../services/dice/diceRoller.js'
import { applyHealingToTarget } from '../../services/rules/combat/applyHealing.js'
import { addEntry } from '../../services/ui/logService.js'
import { getCombatContext } from '../../services/rules/combat/damageUtils.js'
import './ArcaneVigorModal.css'

function ArcaneVigorModal({ hitDieSize, spellcastingAbility, spellcastingAbilityModifier, diceCount, slotLevel, playerName, campaignName, onClose, onComplete }) {
    const [rolledDice, setRolledDice] = useState([]);
    const [totalHealing, setTotalHealing] = useState(0);
    const [healingApplied, setHealingApplied] = useState(false);

    const storedHitDice = Number(getRuntimeValue(playerName, 'shortRestHitDice', campaignName) ?? diceCount);
    const availableHitDice = Math.max(0, storedHitDice - rolledDice.length);

    const handleRollDie = () => {
        if (availableHitDice <= 0) return;
        const { total, rolls } = rollDice(1, hitDieSize);
        const newEntry = { roll: rolls[0], total };
        setRolledDice(prev => [...prev, newEntry]);
    };

    const handleApplyHealing = async () => {
        if (rolledDice.length === 0) return;
        const rollTotal = rolledDice.reduce((sum, d) => sum + d.total, 0);
        const healing = rollTotal + spellcastingAbilityModifier;

        const combatSummary = await getCombatContext(campaignName);
        let actualHeal = 0;
        let newHp = 0;
        let maxHp = 0;

        if (combatSummary) {
            const result = applyHealingToTarget(combatSummary, playerName, healing, campaignName);
            if (result) {
                actualHeal = result.actualHeal;
                newHp = result.newHp;
                const creature = combatSummary.creatures.find(c => c.name === playerName);
                maxHp = creature?.maxHp || 0;
            }
        }

        const diceConsumed = rolledDice.length;
        const remainingHitDice = Math.max(0, storedHitDice - diceConsumed);
        setRuntimeValue(playerName, 'shortRestHitDice', remainingHitDice, campaignName);

        setTotalHealing(actualHeal);
        setHealingApplied(true);

        addEntry(campaignName, {
            type: 'spell',
            characterName: playerName,
            targetName: playerName,
            spellName: 'Arcane Vigor',
            spellLevel: slotLevel,
            castingTime: 'Bonus Action',
            diceRolled: diceConsumed,
            hitDieSize: hitDieSize,
            rollTotal: rollTotal,
            abilityModifier: spellcastingAbilityModifier,
            healing: actualHeal,
            hitDiceRemaining: remainingHitDice,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[ArcaneVigor] Error logging:', e); });

        addEntry(campaignName, {
            type: 'hp_change',
            targetName: playerName,
            delta: actualHeal,
            currentHp: newHp,
            maxHp: maxHp,
            isHealing: true,
            sourceName: playerName,
            note: 'Arcane Vigor',
            formula: `${diceConsumed}d${hitDieSize} + ${spellcastingAbilityModifier}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[ArcaneVigor] Error logging hp_change:', e); });

        onComplete && onComplete();
    };

    const rollTotal = rolledDice.reduce((sum, d) => sum + d.total, 0);
    const projectedHealing = rollTotal + spellcastingAbilityModifier;

    return (
        <div className="arcane-vigor-overlay">
            <div className="arcane-vigor-modal">
                <h3><i className="fa-solid fa-wand-sparkles"></i> Arcane Vigor</h3>
                <p className="arcane-vigor-description">
                    Roll your unexpended Hit Point Dice and regain HP equal to the roll total + {spellcastingAbilityModifier} ({spellcastingAbility} modifier).
                </p>

                <div className="arcane-vigor-section">
                    <h4>Hit Dice</h4>
                    <p>d{hitDieSize} — {availableHitDice} of {storedHitDice} remaining (up to {diceCount} dice allowed)</p>
                    <div className="arcane-vigor-dice-row">
                        <button
                            className="char-btn"
                            onClick={handleRollDie}
                            disabled={availableHitDice <= 0 || healingApplied}
                        >
                            <i className="fa-solid fa-dice"></i> Roll One (d{hitDieSize})
                        </button>
                    </div>
                </div>

                {rolledDice.length > 0 && (
                    <div className="arcane-vigor-roll-log">
                        <table>
                            <thead>
                                <tr><th>Roll</th><th>Result</th></tr>
                            </thead>
                            <tbody>
                                {rolledDice.map((entry, i) => (
                                    <tr key={i}>
                                        <td>d{hitDieSize} = {entry.roll}</td>
                                        <td>{entry.total}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="arcane-vigor-total">
                            <b>Roll Total: {rollTotal} + {spellcastingAbilityModifier} = {projectedHealing} HP</b>
                        </p>
                    </div>
                )}

                {healingApplied && (
                    <div className="arcane-vigor-applied">
                        <i className="fa-solid fa-check"></i> {totalHealing} HP healed ({rolledDice.length} hit dice consumed, {storedHitDice - rolledDice.length} remaining)
                    </div>
                )}

                <div className="arcane-vigor-actions">
                    <button
                        className="char-btn"
                        onClick={handleApplyHealing}
                        disabled={rolledDice.length === 0 || healingApplied}
                    >
                        <i className="fa-solid fa-heart"></i> Apply Healing
                    </button>
                    <button
                        className="char-btn"
                        onClick={onClose}
                        disabled={healingApplied}
                    >
                        <i className="fa-solid fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ArcaneVigorModal
