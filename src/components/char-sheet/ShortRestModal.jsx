
import React from 'react'
import storage from '../../services/storage.js'
import { rollDice } from '../../services/diceRoller.js'

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

function ShortRestModal({ playerStats, campaignName, onClose, onComplete }) {
    const [remainingHitDice, setRemainingHitDice] = React.useState(() => {
        const stored = storage.getProperty(playerStats.name, 'shortRestHitDice', campaignName);
        return stored != null ? stored : playerStats.level;
    });
    const [recoveredHp, setRecoveredHp] = React.useState(0);
    const [rollLog, setRollLog] = React.useState([]);

    const maxHitDice = playerStats.level;
    const hitDie = playerStats.class?.class_levels?.[playerStats.level - 1]?.hit_die || 8;
    const conBonus = playerStats.abilities?.find(a => a.name === 'Constitution')?.bonus || 0;

    const handleRollOne = () => {
        if (remainingHitDice <= 0) return;
        const { total, rolls } = rollDice(1, hitDie);
        const hp = Math.max(1, total + conBonus);
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
            const hp = Math.max(1, total + conBonus);
            totalHp += hp;
            newRolls.push({ roll: rolls[0], hp });
        }
        setRemainingHitDice(0);
        setRecoveredHp(prev => prev + totalHp);
        setRollLog(prev => [...prev, ...newRolls]);
    };

    const handleComplete = () => {
        storage.setProperty(playerStats.name, 'shortRestHitDice', remainingHitDice, campaignName);

        const shortRestResources = [
            'channelDivinityCharges',
            'wildShapeUses',
            'secondWindUses',
            'psionicEnergy',
            'focusPoints',
        ];
        shortRestResources.forEach((key) => {
            storage.setProperty(playerStats.name, key, null, campaignName);
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
                                        <tr key={i}>
                                            <td>{entry.roll}</td>
                                            <td>{entry.hp}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="short-rest-total"><b>Total HP Recovered:</b> {recoveredHp}</p>
                        </div>
                    )}
                </div>

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
