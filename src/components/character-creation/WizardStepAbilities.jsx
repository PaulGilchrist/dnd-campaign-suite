import { useState, useEffect } from 'react';
import './WizardStepAbilities.css';
import { loadAbilityScores, loadValidationRules } from '../../services/ui/dataLoader.js';
import { fetchBackgroundData } from '../../services/ui/dataLoader.js';

function parseBackgroundAbilityScores(abilityScoresStr) {
  if (!abilityScoresStr) return [];
  return abilityScoresStr.split(/,\s+| and /i)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function WizardStepAbilities({
  formData, 
  errors, 
  onAbilityBaseScoreChange,
  onAbilityImprovementChange,
  onAbilityMiscBonusChange,
  onBgAbilityBonusChange,
  _backgroundAbilityChoices,
  _preSelectedBackgroundAbility
}) {
  const [pointBuyCosts, setPointBuyCosts] = useState({});
  const [pointsAllowed, setPointsAllowed] = useState(24);
  const [abilityNames, setAbilityNames] = useState(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);
  const [bgAbilityChoices, setBgAbilityChoices] = useState([]);
  const [bgAbilityAssignments, setBgAbilityAssignments] = useState({});
  const [bgValidationWarnings, setBgValidationWarnings] = useState([]);

  useEffect(() => {
    const loadNames = async () => {
      const scores = await loadAbilityScores();
      setAbilityNames(scores.map(a => a.full_name));
     };
    loadNames();
  }, []);

  useEffect(() => {
    const loadBgAbilities = async () => {
      if (formData.rules !== '2024' || !formData.background) {
        setBgAbilityChoices([]);
        setBgAbilityAssignments({});
        setBgValidationWarnings([]);
        return;
      }
      try {
        const bgData = await fetchBackgroundData(formData.background, '2024');
        if (bgData?.ability_scores) {
          const names = parseBackgroundAbilityScores(bgData.ability_scores);
          setBgAbilityChoices(names);
          const stored = localStorage.getItem(`_bg_abilities_${formData.background}`);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              setBgAbilityAssignments(parsed);
            } catch (e) {
              const defaults = {};
              names.forEach(name => { defaults[name] = 1; });
              setBgAbilityAssignments(defaults);
            }
          } else {
            const defaults = {};
            names.forEach(name => { defaults[name] = 1; });
            setBgAbilityAssignments(defaults);
          }
        } else {
          setBgAbilityChoices([]);
          setBgAbilityAssignments({});
        }
      } catch (error) {
        console.error('Error loading background ability scores:', error);
        setBgAbilityChoices([]);
        setBgAbilityAssignments({});
      }
    };
    loadBgAbilities();
  }, [formData.background, formData.rules]);

  useEffect(() => {
    if (formData.rules !== '2024' || bgAbilityChoices.length === 0) {
      setBgValidationWarnings([]);
      return;
    }

    const warnings = [];
    const totalAssigned = Object.values(bgAbilityAssignments).reduce((sum, val) => sum + val, 0);
    
    if (totalAssigned < 3) {
      warnings.push(`You must assign at least 3 points to your background abilities (+2 and +1, or +1 to all three). Currently assigned: ${totalAssigned}.`);
    }
    
    if (totalAssigned > 3) {
      warnings.push(`You have assigned ${totalAssigned} points to background abilities. The maximum is 3 (+2 and +1, or +1 to all three).`);
    }

    const maxBonus = Math.max(...Object.values(bgAbilityAssignments), 0);
    if (maxBonus > 2) {
      warnings.push('No single ability can receive more than +2 from your background.');
    }

    setBgValidationWarnings(warnings);
  }, [bgAbilityAssignments, bgAbilityChoices, formData.rules]);

  useEffect(() => {
    const loadCosts = async () => {
      try {
        const version = formData.rules || '5e';
        const rules = await loadValidationRules(version);
        setPointBuyCosts(rules.point_buy?.costs || {});
        setPointsAllowed(rules.point_buy?.total_points ?? 24);
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

  const isBgAbility = (abilityName) => {
    return bgAbilityChoices.includes(abilityName);
  };

  const getBgAbilityBonus = (abilityName) => {
    return bgAbilityAssignments[abilityName] || 0;
  };

  const handleBgAbilityChange = (abilityName, newBonus) => {
    const bonus = Math.max(0, Math.min(2, parseInt(newBonus) || 0));
    setBgAbilityAssignments(prev => {
      const newAssignments = { ...prev, [abilityName]: bonus };
      const bgKey = `_bg_abilities_${formData.background}`;
      if (Object.keys(newAssignments).length > 0) {
        localStorage.setItem(bgKey, JSON.stringify(newAssignments));
      } else {
        localStorage.removeItem(bgKey);
      }
      return newAssignments;
    });
    onBgAbilityBonusChange?.(abilityName, bonus);
  };

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
           <strong>Background Ability Scores ({formData.background}):</strong>
           <div className="bg-ability-rule-text">
             Your background grants ability score increases. Increase one ability by 2 and another by 1, or increase all three by 1. None of these increases can raise a score above 20.
           </div>
           <div className="bg-ability-assignments">
             {bgAbilityChoices.map((ability) => (
               <div key={ability} className="bg-ability-assignment">
                 <span className="bg-ability-name">{ability}:</span>
                 <select
                   value={getBgAbilityBonus(ability)}
                   onChange={(e) => handleBgAbilityChange(ability, e.target.value)}
                   className="bg-ability-select"
                 >
                   <option value={0}>+0</option>
                   <option value={1}>+1</option>
                   <option value={2}>+2</option>
                 </select>
               </div>
             ))}
           </div>
           {bgValidationWarnings.length > 0 && (
             <div className="bg-ability-warnings">
               {bgValidationWarnings.map((warning, index) => (
                 <div key={index} className="bg-ability-warning">
                   <i className="fa-solid fa-triangle-exclamation"></i> {warning}
                 </div>
               ))}
             </div>
           )}
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
        const isBgAbilityScore = isBgAbility(ability);
        const bgBonus = getBgAbilityBonus(ability);

         return (
            <div key={ability} className={`ability-score-card ${isBgAbilityScore ? 'bg-ability-score' : ''}`}>
              {isBgAbilityScore && (
                <div className="bg-ability-badge">
                  <i className="fa-solid fa-star"></i> Background: +{bgBonus}
                </div>
              )}
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
