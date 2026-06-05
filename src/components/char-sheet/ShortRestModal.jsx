
import React from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js'
import { rollDice } from '../../services/diceRoller.js'
import { getHitDieSize, computeHitDieRecovery, SHORT_REST_RESOURCES, getShortRestResourceLabels } from '../../services/restRules.js'
import { clearAllExpirationEffects } from '../../services/expirations.js'
import { getClassFeatures } from '../../services/classFeatures.js'
import { evaluateAutoExpression } from '../../services/automationService.js'
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
    const [restorationRequested, setRestorationRequested] = React.useState(false);

    const isSorcerer = playerStats?.class?.name === 'Sorcerer';
    const sorcRestoration = isSorcerer && (playerStats.automation?.passives ?? []).find(
        a => a.type === 'resource_restoration'
      );
    const restorationCur = getRuntimeValue(playerStats.name, 'sorcerousRestorationUses');
    const restorationAvailable = !!sorcRestoration && restorationCur !== 0;

    const maxHitDice = playerStats.level;
    const hitDie = getHitDieSize(playerStats);
    const conBonus = playerStats.abilities?.find(a => a.name === 'Constitution')?.bonus || 0;
    const classFeatures = getClassFeatures(playerStats);
    const songOfRestDie = classFeatures?.songOfRestDie || null;
    const resourceLabels = React.useMemo(() => getShortRestResourceLabels(playerStats), [playerStats]);

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

    const handleApplySongOfRest = async () => {
        if (!songOfRestDie || songOfRestApplied) return;
        const { total } = rollDice(1, songOfRestDie);
        const bonus = Math.max(1, total + conBonus);
        const combatSummary = await getCombatContext(campaignName);
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

    const restoreAmount = isSorcerer ? evaluateAutoExpression(sorcRestoration?.restore_expression ?? '', playerStats, playerStats.proficiency, playerStats.level) : 0;

    const handleApplySorcerousRestoration = () => {
        if (!sorcRestoration || !restorationAvailable || restorationRequested) return;
        setRestorationRequested(true);
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

        if (sorcRestoration && restorationAvailable && restorationRequested) {
            let curSorcery = getRuntimeValue(playerStats.name, 'sorceryPoints');
            const maxSp = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
            setRuntimeValue(playerStats.name, 'sorceryPoints', Math.min(maxSp, (curSorcery != null ? Number(curSorcery) : 0) + restoreAmount), campaignName);
            setRuntimeValue(playerStats.name, 'sorcerousRestorationUses', 0, campaignName);
            }

        clearAllExpirationEffects(playerStats.name, campaignName);

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

                  {sorcRestoration && (restorationAvailable || restorationRequested) && (
                       <div className="short-rest-section">
                           <h4>Sorcerous Restoration</h4>
                           <p>Regain {restoreAmount} expended sorcery points.</p>
                           <div className="short-rest-dice-row">
                               {restorationRequested ? (
                                   <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Restoration requested</span>
                                 ) : (
                                   <button className="char-btn" onClick={handleApplySorcerousRestoration} disabled={!restorationAvailable}>
                                       <i className="fas fa-wand-magic-sparkles"></i> Regain {restoreAmount} Sorcery Points
                                   </button>
                                 )}
                           </div>
                       </div>
                   )}

                    {resourceLabels.length > 0 && (
                      <div className="short-rest-section">
                          <h4>Resources Restored</h4>
                          <ul>
                              {resourceLabels.map(label => (
                                  <li key={label}>{label}</li>
                                 ))}
                          </ul>
                      </div>
                  )}

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
