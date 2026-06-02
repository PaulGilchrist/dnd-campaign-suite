
import React from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js'
import { rollDice } from '../../services/diceRoller.js'
import { getHitDieSize, computeHitDieRecovery, SHORT_REST_RESOURCES } from '../../services/restRules.js'
import { getClassFeatures } from '../../services/classFeatures.js'
import { getCombatContext } from '../../services/damageUtils.js'
import { applyHealingToTarget } from '../../services/applyHealing.js'

function ShortRestModal({ playerStats, campaignName, onClose, onComplete }) {
    const [remainingHitDice, setRemainingHitDice] = React.useState(() => {
        const stored = getRuntimeValue(playerStats.name, 'shortRestHitDice');
        return stored != null ? stored : playerStats.level;
     });
    const [recoveredHp, setRecoveredHp] = React.useState(0);
    const [rollLog, setRollLog] = React.useState([]);
    const [songOfRestApplied, setSongOfRestApplied] = React.useState(false);

    const maxHitDice = playerStats.level;
    const hitDie = getHitDieSize(playerStats);
    const conBonus = playerStats.abilities?.find(a => a.name === 'Constitution')?.bonus || 0;
    const classFeatures = getClassFeatures(playerStats);
    const songOfRestDie = classFeatures?.songOfRestDie || null;

    const handleRollOne = () => {
        if (remainingHitDice <= 0) return;
        const { total, rolls } = rollDice(1, hitDie);
        const hp = computeHitDieRecovery(total, conBonus);
        setRemainingHitDice(prev => prev - 1);
        setRecoveredHp(prev => prev + hp);
        setRollLog(prev => [...prev, { roll: rolls[0], hp }]);
     };

    const handleRollAll = () => {
        if (remainingHitDice <= 0) return;
        let totalHp = 0;
        let newRolls = [];
        for (let i = 0; i < remainingHitDice; i++) {
            const { total, rolls } = rollDice(1, hitDie);
            const hp = computeHitDieRecovery(total, conBonus);
            totalHp += hp;
            newRolls.push({ roll: rolls[0], hp });
         }
        setRemainingHitDice(0);
        setRecoveredHp(prev => prev + totalHp);
        setRollLog(prev => [...prev, ...newRolls]);
     };

    const handleApplySongOfRest = () => {
        if (!songOfRestDie || songOfRestApplied) return;
        const { total } = rollDice(1, songOfRestDie);
        const bonus = Math.max(1, total + conBonus);
        const combatSummary = getCombatContext();
        if (combatSummary) {
            const result = applyHealingToTarget(combatSummary, playerStats.name, bonus, campaignName);
            if (result) {
                setRecoveredHp(prev => prev + result.actualHeal);
                setRollLog(prev => [...prev, { roll: total, hp: result.actualHeal, isSongOfRest: true }]);
            }
        } else {
            setRecoveredHp(prev => prev + bonus);
            setRollLog(prev => [...prev, { roll: total, hp: bonus, isSongOfRest: true }]);
        }
        setSongOfRestApplied(true);
     };

    const handleComplete = () => {
        setRuntimeValue(playerStats.name, 'shortRestHitDice', remainingHitDice, campaignName);

        let currentHp = getRuntimeValue(playerStats.name, 'currentHitPoints');
        if (currentHp == null || currentHp === '') {
            currentHp = playerStats.hitPoints;
         } else {
            currentHp = Number(currentHp) + recoveredHp;
         }
        setRuntimeValue(playerStats.name, 'currentHitPoints', Math.min(playerStats.hitPoints, currentHp), campaignName);

        SHORT_REST_RESOURCES.forEach((key) => {
            setRuntimeValue(playerStats.name, key, null, campaignName);
        });

        onComplete && onComplete();
     };

    React.useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className="short-rest-overlay no-print" onClick={onClose}>
            <div className="short-rest-modal" onClick={(e) => e.stopPropagation()}>
                <h3><i className="fa-solid fa-bed"></i> Short Rest</h3>

                <div className="short-rest-section">
                    <h4>Hit Dice</h4>
                    <p>d{hitDie} &mdash; {remainingHitDice} of {maxHitDice} remaining</p>
                    <div className="short-rest-dice-row">
                        <button className="char-btn" onClick={handleRollOne} disabled={remainingHitDice <= 0}>
                            <i className="fa-solid fa-dice"></i> Roll One
                        </button>
                        <button className="char-btn" onClick={handleRollAll} disabled={remainingHitDice <= 0}>
                            <i className="fa-solid fa-dice-d6"></i> Roll All ({remainingHitDice})
                        </button>
                    </div>
                     {rollLog.length > 0 && (
                         <div className="short-rest-roll-log">
                             <table>
                                 <thead>
                                     <tr><th>Roll</th><th>HP Recovered</th></tr>
                                 </thead>
                                 <tbody>
                                     {rollLog.map((entry, i) => (
                                         <tr key={i} className={entry.isSongOfRest ? 'short-rest-song-row' : ''}>
                                             <td>{entry.roll}{entry.isSongOfRest ? ' (Song of Rest)' : ''}</td>
                                             <td>{entry.hp}</td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                             <p className="short-rest-total"><b>Total HP Recovered:</b> {recoveredHp}</p>
                         </div>
                     )}
                 </div>

                 {songOfRestDie && !songOfRestApplied && (
                     <div className="short-rest-section">
                         <h4>Song of Rest</h4>
                         <p>Roll d{songOfRestDie} + CON bonus and add to recovered HP.</p>
                         <div className="short-rest-dice-row">
                             <button className="char-btn" onClick={handleApplySongOfRest}>
                                 <i className="fa-solid fa-music"></i> Apply Song of Rest (d{songOfRestDie})
                             </button>
                         </div>
                     </div>
                 )}

                <div className="short-rest-section">
                    <h4>Resources Restored</h4>
                    <ul>
                        <li>Channel Divinity</li>
                        <li>Wild Shape</li>
                        <li>Second Wind</li>
                        <li>Psionic Energy</li>
                        <li>Focus Points</li>
                    </ul>
                </div>

                <div className="short-rest-actions">
                    <button className="char-btn" onClick={handleComplete}>
                        <i className="fa-solid fa-check"></i> Complete Short Rest
                    </button>
                    <button className="char-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default ShortRestModal
