import { useState } from 'react';
import './diceRollResult.css';

function DiceRollResult({ name, type, rolls, bonus = 0, formula = '', modifier = 0, targetName, targetAc, hit, resistanceNotice }) {
    const [mode, setMode] = useState('normal'); // 'normal', 'advantage', 'disadvantage'

    // Only d20 (single die, 20 sides) allows advantage/disadvantage
    const isD20 = type === 'd20';
    
    // Calculate current result based on mode
    let finalRoll = rolls[0] || 0;

    if (isD20) {
        // Note: useDiceRoll will provide two d20 rolls if type is 'd20'
        const r1 = rolls[0] || 0;
        const r2 = rolls[1] || 0;
        
        if (mode === 'advantage') {
            finalRoll = Math.max(r1, r2);
        } else if (mode === 'disadvantage') {
            finalRoll = Math.min(r1, r2);
        } else {
            finalRoll = r1;
        }
    } else {
        // For non-d20 rolls, total is sum of all rolls (handled by useDiceRoll primarily, 
        // but we ensure consistence here if logic changes)
        finalRoll = rolls.reduce((sum, r) => sum + r, 0);
    }

    const total = finalRoll + bonus + modifier;
    const isCrit = isD20 && finalRoll === 20;

    return (
        <div className="dice-roll-result">
            <div className="dice-roll-header">
                <i className={`fa-solid ${
                    type === 'd20' ? 'fa-dice-d20' : 
                    type === 'attack' ? 'fa-crosshairs' : 
                    type === 'save' ? 'fa-shield-halved' : 
                    type === 'initiative' ? 'fa-gavel' : 'fa-bolt'
                }`}></i>
                {name}
            </div>
            <div className="dice-roll-total">{total}</div>
            <div className="dice-roll-breakdown">
                {formula ? `${formula}: ` : type === 'd20' ? 'd20 ' : ''}
                <span className="dice-rolled">
                    {isD20 
                        ? (mode === 'normal' ? rolls[0] : finalRoll)
                        : rolls.join(', ')
                    }
                </span>
                {(bonus + modifier) >= 0 && (bonus + modifier) !== 0 ? ` +${bonus + modifier}` : 
                 (bonus + modifier) < 0 ? ` ${bonus + modifier}` : ''}
            </div>
            
             {isD20 && (
                 <div className="dice-roll-toggles">
                     <label className={`badge-toggle ${mode === 'advantage' ? 'active' : ''}`}>
                         <input 
                            type="checkbox" 
                            checked={mode === 'advantage'} 
                            onChange={() => setMode(mode === 'advantage' ? 'normal' : 'advantage')}
                             style={{ display: 'none' }}
                         />
                         Advantage
                     </label>
                     <label className={`badge-toggle ${mode === 'disadvantage' ? 'active' : ''}`}>
                         <input 
                            type="checkbox" 
                            checked={mode === 'disadvantage'} 
                            onChange={() => setMode(mode === 'disadvantage' ? 'normal' : 'disadvantage')}
                             style={{ display: 'none' }}
                         />
                         Disadvantage
                     </label>
                 </div>
             )}

            {isCrit && <div className="dice-roll-crit">Critical Hit!</div>}
            {targetName && hit !== undefined && (
              <div className={`dice-roll-hit-miss ${hit ? 'hit' : 'miss'}`}>
                {hit ? '✓ HIT' : '✗ MISS'} ({total} vs AC {targetAc})
              </div>
            )}
            {resistanceNotice && (
              <div className="dice-roll-resistance">{resistanceNotice}</div>
            )}
            <div className="dice-roll-hint">click to dismiss</div>
        </div>
    );
}

export default DiceRollResult;
