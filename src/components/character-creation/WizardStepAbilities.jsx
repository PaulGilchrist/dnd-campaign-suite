import { useState, useEffect } from 'react';
import './WizardStepAbilities.css';
import { loadAbilityScores, loadValidationRules } from '../../services/ui/dataLoader.js';
import { fetchBackgroundData } from '../../services/ui/dataLoader.js';

function parseBackgroundAbilityScores(abilityScoresStr) {
  if (!abilityScoresStr) return [];
  return abilityScoresStr.split(/,?\s+and\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function WizardStepAbilities({
  formData, 
  errors, 
  onAbilityBaseScoreChange,
  onAbilityImprovementChange,
  onAbilityMiscBonusChange,
  _backgroundAbilityChoices,
  preSelectedBackgroundAbility,
  onBackgroundAbilityChoose,
  onBackgroundAbilityRemove
}) {
  const [pointBuyCosts, setPointBuyCosts] = useState({});
  const [pointsAllowed, setPointsAllowed] = useState(27);
  const [abilityNames, setAbilityNames] = useState(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);
  const [bgAbilityChoices, setBgAbilityChoices] = useState([]);

    // Load ability names from JSON
  useEffect(() => {
    const loadNames = async () => {
      const scores = await loadAbilityScores();
      setAbilityNames(scores.map(a => a.full_name));
     };
    loadNames();
  }, []);

  // Load background ability score choices for 2024
  useEffect(() => {
    const loadBgAbilities = async () => {
      if (formData.rules !== '2024' || !formData.background) {
        setBgAbilityChoices([]);
        return;
      }
      try {
        const bgData = await fetchBackgroundData(formData.background, '2024');
        if (bgData?.ability_scores) {
          setBgAbilityChoices(parseBackgroundAbilityScores(bgData.ability_scores));
        } else {
          setBgAbilityChoices([]);
        }
      } catch (error) {
        console.error('Error loading background ability scores:', error);
        setBgAbilityChoices([]);
      }
    };
    loadBgAbilities();
  }, [formData.background, formData.rules]);

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

  return (
     <div className="wizard-step wizard-step-abilities wizard-step-4">
       <h2>Step 5: Ability Scores</h2>
       <div className="step-description">
       Use point buy: Each ability base score minimum is 8 and maximum is 15. You have <span className="points-remaining">{Math.max(0, pointsRemaining)} points</span> remaining to spend.
        (Total points allowed: {pointsAllowed})
       </div>
        <div className="step-description">
         Total score (base + improvements + misc) cannot exceed 20 for any ability.
       </div>

       {bgAbilityChoices.length > 0 && (
        <div className="step-description bg-ability-choice">
          <strong>Background Ability Score:</strong> Your background ({formData.background}) grants +1 to one of the following abilities. Choose one:{' '}
          {bgAbilityChoices.map((ability) => {
            const isSelected = preSelectedBackgroundAbility === ability;
            const isDisabled = isSelected || (formData.abilities?.find(a => a.name === ability)?.miscBonus || 0) <= 0;
            return (
              <button
                key={ability}
                type="button"
                className={`bg-ability-btn ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (isSelected) {
                    onBackgroundAbilityRemove?.(ability);
                  } else {
                    onBackgroundAbilityChoose?.(ability);
                  }
                }}
              >
                {ability} {isSelected ? '(chosen)' : ''}
              </button>
            );
          })}
        </div>
      )}

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
