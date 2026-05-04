import React, { useState, useEffect } from 'react';
import './wizard-step-abilities.css';
import { loadAbilityScores, loadValidationRules } from '../../services/data-loader';

function WizardStepAbilities({
  formData, 
  errors, 
  onAbilityBaseScoreChange,
  onAbilityImprovementChange,
  onAbilityMiscBonusChange
}) {
  const [pointBuyCosts, setPointBuyCosts] = useState({});
  const [pointsAllowed, setPointsAllowed] = useState(27);
  const [abilityNames, setAbilityNames] = useState(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);

	 // Load ability names from JSON
  useEffect(() => {
    const loadNames = async () => {
      const scores = await loadAbilityScores();
      setAbilityNames(scores.map(a => a.full_name));
     };
    loadNames();
  }, []);

       // Load point buy costs and validation rules from JSON
  useEffect(() => {
    const loadCosts = async () => {
      try {
        const version = formData.rules || '5e';
        const rules = await loadValidationRules(version);
        setPointBuyCosts(rules.point_buy?.costs || {});
        setPointsAllowed(rules.point_buy?.total_points ?? 27);
      } catch (error) {
        console.error('Error loading validation rules:', error);
      }
         };
    loadCosts();
       }, [formData.rules]);

  const totalPointsSpent = (formData.abilities || []).reduce((sum, ability) => {
    const baseScore = parseInt(ability.baseScore) || 8;
    return sum + (pointBuyCosts[baseScore] || 0);
       }, 0);

  const pointsRemaining = pointsAllowed - totalPointsSpent;

  const calculateTotalScore = (ability) => {
    const base = parseInt(ability.baseScore) || 8;
    const improvements = parseInt(ability.abilityImprovements) || 0;
    const misc = parseInt(ability.miscBonus) || 0;
    return base + improvements + misc;
  };

  return (
     <div className="wizard-step wizard-step-4">
       <h2>Step 5: Ability Scores</h2>
       <div className="step-description">
       Use point buy: Each ability base score minimum is 8 and maximum is 15. You have <span className="points-remaining">{Math.max(0, pointsRemaining)} points</span> remaining to spend.
        (Total points allowed: {pointsAllowed})
       </div>
       <div className="step-description">
        Total score (base + improvements + misc) cannot exceed 20 for any ability.
      </div>

       <div className="ability-scores-grid">
         {abilityNames.map((ability, index) => {
         const abilityData = formData.abilities?.[index] || { baseScore: '8', abilityImprovements: '0', miscBonus: '0' };
         const baseScore = parseInt(abilityData.baseScore) || 8;
         const improvements = parseInt(abilityData.abilityImprovements) || 0;
         const misc = parseInt(abilityData.miscBonus) || 0;
         const totalScore = baseScore + improvements + misc;
         const cost = pointBuyCosts[baseScore] || 0;

          return (
             <div key={ability} className="ability-score-card">
               <h4>{ability}</h4>
               <div className="form-group ability-score-form-group">
                                 <label htmlFor={`base-score-${index}`}>Base Score (8-15)</label>
                                 <input
                               id={`base-score-${index}`}
                               type="number"
                               min="8"
                               max="15"
                                value={abilityData.baseScore}
                                onChange={(e) => onAbilityBaseScoreChange(index, e.target.value)}
                                className={errors[`ability_${index}_baseScore`] ? 'error' : ''}
                                 />
                                 <span className="point-cost">Cost: {cost}</span>
                                 {errors[`ability_${index}_baseScore`] && <span className="error-message">{errors[`ability_${index}_baseScore`]}</span>}
                               </div>
                               <div className="form-group ability-score-form-group">
                                 <label htmlFor={`improvements-${index}`}>Improvements</label>
                                 <input
                                id={`improvements-${index}`}
                                type="number"
                                min="0"
                                value={abilityData.abilityImprovements}
                                onChange={(e) => onAbilityImprovementChange(index, parseInt(e.target.value))}
                                className={errors[`ability_${index}_abilityImprovements`] ? 'error' : ''}
                                 />
                                 {errors[`ability_${index}_abilityImprovements`] && <span className="error-message">{errors[`ability_${index}_abilityImprovements`]}</span>}
                               </div>
                               <div className="form-group ability-score-form-group">
                                 <label htmlFor={`misc-bonus-${index}`}>Misc Bonus</label>
                                 <input
                                id={`misc-bonus-${index}`}
                                type="number"
                                min="0"
                                value={abilityData.miscBonus}
                                onChange={(e) => onAbilityMiscBonusChange(index, parseInt(e.target.value))}
                                className={errors[`ability_${index}_miscBonus`] ? 'error' : ''}
                                 />
                                 {errors[`ability_${index}_miscBonus`] && <span className="error-message">{errors[`ability_${index}_miscBonus`]}</span>}
                               </div>
               <div className={`total-score ${totalScore > 20 ? 'error' : ''}`}>
                Total: <strong>{totalScore}</strong>
                 {totalScore > 20 && <span className="error-message"> (max 20)</span>}
               </div>
             </div>
           );
         })}
       </div>
     </div>
   );
}

export default WizardStepAbilities;
