import { useState, useEffect, useMemo } from 'react';
import './WizardStepAbilities.css';
import { loadAbilityScores, loadValidationRules, fetchBackgroundData } from '../../services/ui/dataLoader.js';
import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';
import { computeRaceBuffs } from '../../services/character/raceBuffService.js';

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
  onAbilityMiscIncreaseChange,
  onBackgroundIncreaseChange,
  backgroundAbilityChoices,
  backgroundAbilityAssignments = {},
  backgroundValidationWarnings = [],
  allFeats,
  featAbilityChoices = [],
  featAbilityAssignments = {},
  onFeatAbilityChoiceChange,
  onFeatAbilityModeChange,
  racesData = [],
}) {
  const { race } = formData;
  const fullRace = useMemo(() => {
    if (!race?.name) return null;
    return racesData.find(r => r.name === race.name) || null;
  }, [race?.name, racesData]);
  const [pointBuyCosts, setPointBuyCosts] = useState({});
  const [pointsAllowed, setPointsAllowed] = useState(27);
  const [abilityNames, setAbilityNames] = useState(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);
  const [nonChoiceFeatIncreases, setNonChoiceFeatIncreases] = useState({});
  const [localBackgroundAbilityChoices, setLocalBackgroundAbilityChoices] = useState([]);
  const [localBackgroundAbilityAssignments, setLocalBackgroundAbilityAssignments] = useState({});
  const [localBackgroundValidationWarnings, setLocalBackgroundValidationWarnings] = useState([]);

  const useProps = backgroundAbilityChoices !== undefined;

  const effectiveBackgroundAbilityChoices = useProps ? backgroundAbilityChoices : localBackgroundAbilityChoices;
  const effectiveBackgroundAbilityAssignments = useProps ? backgroundAbilityAssignments : localBackgroundAbilityAssignments;
  const effectiveBackgroundValidationWarnings = useProps ? backgroundValidationWarnings : localBackgroundValidationWarnings;

  const racialAbilityIncreases = useMemo(() => {
    if (formData.rules !== '5e' || !fullRace?.name) {
      return {};
    }
    const subraceName = race?.subrace?.name;
    const subrace = subraceName ? fullRace.subraces?.find(sr => sr.name === subraceName) : null;
    const raceBuffs = computeRaceBuffs(fullRace, { race: { name: fullRace.name, subrace: subrace || { name: subraceName } }, rules: formData.rules }, '5e');
    const increases = {};
    raceBuffs.abilityScoreIncreases.forEach(inc => {
      increases[inc.name] = (increases[inc.name] || 0) + inc.amount;
    });
    return increases;
  }, [fullRace, race?.subrace?.name, formData.rules]);

  useEffect(() => {
    const loadNames = async () => {
      const scores = await loadAbilityScores();
      setAbilityNames(scores.map(a => a.full_name));
    };
    loadNames();
  }, []);

  useEffect(() => {
    const computeNonChoiceFeats = () => {
      if (!allFeats || allFeats.length === 0 || !formData.feats || formData.feats.length === 0) {
        setNonChoiceFeatIncreases({});
        return;
      }

      const buffs = computeAllFeatBuffs(formData, allFeats);
      const nonChoice = buffs.abilityScoreIncreases.filter(inc => inc.name && inc.name !== 'any');

      const increases = {};
      nonChoice.forEach(inc => {
        const name = inc.name;
        increases[name] = (increases[name] || 0) + (inc.amount || 0);
      });
      setNonChoiceFeatIncreases(increases);
    };

    computeNonChoiceFeats();
  }, [formData, allFeats]);

  useEffect(() => {
    const loadBackgroundAbilities = async () => {
      if (useProps || formData.rules !== '2024' || !formData.background) {
        setLocalBackgroundAbilityChoices([]);
        setLocalBackgroundAbilityAssignments({});
        setLocalBackgroundValidationWarnings([]);
        return;
      }
      try {
        const bgData = await fetchBackgroundData(formData.background, '2024');
        if (bgData?.ability_scores) {
          const names = parseBackgroundAbilityScores(bgData.ability_scores);
          setLocalBackgroundAbilityChoices(names);
          const stored = localStorage.getItem(`_background_abilities_${formData.background}`);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              setLocalBackgroundAbilityAssignments(parsed);
            } catch (_e) {
              const defaults = {};
              names.forEach(name => { defaults[name] = 1; });
              setLocalBackgroundAbilityAssignments(defaults);
            }
          } else {
            const defaults = {};
            names.forEach(name => { defaults[name] = 1; });
            setLocalBackgroundAbilityAssignments(defaults);
          }
        } else {
          setLocalBackgroundAbilityChoices([]);
          setLocalBackgroundAbilityAssignments({});
        }
      } catch (error) {
        console.error('Error loading background ability scores:', error);
        setLocalBackgroundAbilityChoices([]);
        setLocalBackgroundAbilityAssignments({});
      }
    };
    loadBackgroundAbilities();
  }, [formData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (useProps || formData.rules !== '2024' || localBackgroundAbilityChoices.length === 0) {
      setLocalBackgroundValidationWarnings([]);
      return;
    }

    const warnings = [];
    const totalAssigned = Object.values(localBackgroundAbilityAssignments).reduce((sum, val) => sum + val, 0);

    if (totalAssigned < 3) {
      warnings.push(`You must assign at least 3 points to your background abilities (+2 and +1, or +1 to all three). Currently assigned: ${totalAssigned}.`);
    }

    if (totalAssigned > 3) {
      warnings.push(`You have assigned ${totalAssigned} points to background abilities. The maximum is 3 (+2 and +1, or +1 to all three).`);
    }

    const maxIncrease = Math.max(...Object.values(localBackgroundAbilityAssignments), 0);
    if (maxIncrease > 2) {
      warnings.push('No single ability can receive more than +2 from your background.');
    }

    setLocalBackgroundValidationWarnings(warnings);
  }, [localBackgroundAbilityAssignments, localBackgroundAbilityChoices, formData.rules]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const totalMiscPoints = (formData.abilities || []).reduce((sum, ability) => {
    return sum + (parseInt(ability.miscIncrease) || 0);
  }, 0);

  const pointsRemaining = pointsAllowed - totalPointsSpent;

  const isBackgroundAbility = (abilityName) => {
    return effectiveBackgroundAbilityChoices.includes(abilityName);
  };

  const getBackgroundIncrease = (abilityName) => {
    return effectiveBackgroundAbilityAssignments[abilityName] || 0;
  };

  const getFeatIncreaseForAbility = (abilityName) => {
    const nonChoice = nonChoiceFeatIncreases[abilityName] || 0;

    let choiceIncrease = 0;
    featAbilityChoices.forEach(group => {
      const saved = featAbilityAssignments[group.id];
      if (!saved) return;

      if (group.type === 'choice') {
        const mode = saved.mode || 'single';
        const assignments = saved.assignments;
        if (mode === 'single' && assignments.single === abilityName) {
          choiceIncrease += group.options.single.amount;
        } else if (mode === 'dual') {
          assignments.dual.forEach(a => {
            if (a === abilityName) {
              choiceIncrease += group.options.dual.amount;
            }
          });
        }
      } else if (group.type === 'fixed' && saved.assignment === abilityName) {
        choiceIncrease += group.amount;
      }
    });

    return nonChoice + choiceIncrease;
  };

  const handleBackgroundIncreaseChange = (abilityName, newIncrease) => {
    const parsedIncrease = Math.max(0, Math.min(2, parseInt(newIncrease) || 0));
    if (!useProps) {
      setLocalBackgroundAbilityAssignments(prev => {
        const newAssignments = { ...prev, [abilityName]: parsedIncrease };
        const backgroundKey = `_background_abilities_${formData.background}`;
        if (Object.keys(newAssignments).length > 0) {
          localStorage.setItem(backgroundKey, JSON.stringify(newAssignments));
        } else {
          localStorage.removeItem(backgroundKey);
        }
        return newAssignments;
      });
    }
    onBackgroundIncreaseChange?.(abilityName, parsedIncrease);
  };

  const handleFeatAbilityChange = (featName, slotIndex, abilityName) => {
    onFeatAbilityChoiceChange?.(featName, slotIndex, abilityName);
  };

  const handleFeatAbilityModeChange = (featName, mode) => {
    onFeatAbilityModeChange?.(featName, mode);
  };

  const hasFeatsWithChoices = featAbilityChoices.length > 0;

  const effectiveAbilityScoreCap = useMemo(() => {
    if (!allFeats || allFeats.length === 0 || !formData.feats || formData.feats.length === 0) {
      return 20;
    }

    const ruleset = formData.rules || '5e';
    let highestMaxValue = 20;

    formData.feats.forEach(featName => {
      const feat = typeof featName === 'object' ? featName.name : featName;
      const foundFeat = allFeats.find(f => f.name === feat);
      if (!foundFeat) return;

      if (ruleset === '2024' && foundFeat.ability_score_increase) {
        const maxVal = foundFeat.ability_score_increase.max_value;
        if (maxVal && maxVal > highestMaxValue) {
          highestMaxValue = maxVal;
        }
      } else if (ruleset === '5e' && foundFeat.description) {
        const desc = foundFeat.description.toLowerCase();
        const hasMax30 = desc.includes('maximum of 30') || desc.includes('maximum of 30.');
        if (hasMax30) {
          highestMaxValue = 30;
        }
      }
    });

    return highestMaxValue;
  }, [allFeats, formData.feats, formData.rules]);

  return (
    <div className="wizard-step wizard-step-abilities wizard-step-4">
      <h2>Step 5: Ability Scores</h2>
      <div className="step-description">
        Use point buy: Each ability base score minimum is 8 and maximum is 15. You have <span className="points-remaining">{Math.max(0, pointsRemaining)} points</span> remaining to spend.
        (Total points allowed: {pointsAllowed})
      </div>
      <div className="step-description">
        Total score (base + feat + background + racial + misc) cannot exceed {effectiveAbilityScoreCap} for any ability.
      </div>

      {effectiveBackgroundAbilityChoices.length > 0 && (
        <div className="step-description bg-ability-choice">
          <strong>Background Ability Scores ({formData.background}):</strong>
          <div className="bg-ability-rule-text">
            Your background grants ability score increases. Increase one ability by 2 and another by 1, or increase all three by 1. None of these increases can raise a score above 20.
          </div>
          <div className="bg-ability-assignments">
            {effectiveBackgroundAbilityChoices.map((ability) => (
              <div key={ability} className="bg-ability-assignment">
                <span className="bg-ability-name">{ability}:</span>
                <select
                  value={getBackgroundIncrease(ability)}
                  onChange={(e) => handleBackgroundIncreaseChange(ability, e.target.value)}
                  className="bg-ability-select"
                >
                  <option value={0}>+0</option>
                  <option value={1}>+1</option>
                  <option value={2}>+2</option>
                </select>
              </div>
            ))}
          </div>
          {effectiveBackgroundValidationWarnings.length > 0 && (
            <div className="bg-ability-warnings">
              {effectiveBackgroundValidationWarnings.map((warning, index) => (
                <div key={index} className="bg-ability-warning">
                  <i className="fa-solid fa-triangle-exclamation"></i> {warning}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {hasFeatsWithChoices && (
        <div className="step-description bg-ability-choice">
          <strong>Feat Ability Score Increases:</strong>
          <div className="bg-ability-rule-text">
            Your selected feats grant ability score increases. Choose which ability score to increase.
          </div>
          <div className="feat-asi-cards">
            {featAbilityChoices.map((group) => (
              <div key={group.id} className="feat-asi-card">
                {group.type === 'fixed' ? (
                  <div className="feat-asi-card-header">
                    <span className="feat-asi-card-name">{group.featName}</span>
                    <select
                      value={featAbilityAssignments[group.id]?.assignment || group.abilityNames[0]}
                      onChange={(e) => handleFeatAbilityChange(group.id, 0, e.target.value)}
                      className="bg-ability-select"
                    >
                      {group.abilityNames.map((abilityName) => (
                        <option key={abilityName} value={abilityName}>{abilityName}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="feat-asi-card-header">
                      <span className="feat-asi-card-name">{group.featName}</span>
                      <div className="feat-asi-mode-toggle">
                        <label className="feat-asi-mode-option">
                          <input
                            type="radio"
                            name={`mode-${group.id}`}
                            checked={(featAbilityAssignments[group.id]?.mode || 'single') === 'single'}
                            onChange={() => handleFeatAbilityModeChange(group.id, 'single')}
                          />
                          +{group.options.single.amount} to one ability
                        </label>
                        <label className="feat-asi-mode-option">
                          <input
                            type="radio"
                            name={`mode-${group.id}`}
                            checked={(featAbilityAssignments[group.id]?.mode || 'single') === 'dual'}
                            onChange={() => handleFeatAbilityModeChange(group.id, 'dual')}
                          />
                          +{group.options.dual.amount} to {group.options.dual.count} abilities
                        </label>
                      </div>
                    </div>
                    <div className="feat-asi-assignments">
                      {(featAbilityAssignments[group.id]?.mode || 'single') === 'single' && (
                        <div className="feat-asi-assignment">
                          <span className="feat-asi-assignment-label">Increase:</span>
                          <select
                            value={featAbilityAssignments[group.id]?.assignments?.single || group.options.single.abilityNames[0]}
                            onChange={(e) => handleFeatAbilityChange(group.id, 0, e.target.value)}
                            className="bg-ability-select"
                          >
                            {group.options.single.abilityNames.map((abilityName) => (
                              <option key={abilityName} value={abilityName}>{abilityName}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {(featAbilityAssignments[group.id]?.mode || 'single') === 'dual' && (
                        (() => {
                          const savedAssignments = featAbilityAssignments[group.id]?.assignments?.dual || [];
                          return group.options.dual.assignments.map((_, i) => (
                            <div key={i} className="feat-asi-assignment">
                              <span className="feat-asi-assignment-label">Ability {i + 1}:</span>
                              <select
                                value={savedAssignments[i] || group.options.dual.abilityNames[0]}
                                onChange={(e) => handleFeatAbilityChange(group.id, i, e.target.value)}
                                className="bg-ability-select"
                              >
                                {group.options.dual.abilityNames.map((abilityName) => (
                                  <option key={abilityName} value={abilityName}>{abilityName}</option>
                                ))}
                              </select>
                            </div>
                          ));
                        })()
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {totalMiscPoints > 0 && (
        <div className="step-description misc-warning">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <span>Misc increases total {totalMiscPoints} point{totalMiscPoints > 1 ? 's' : ''}. These points are not counted against the point buy system and must be approved by your GM.</span>
        </div>
      )}

      <div className="ability-scores-grid">
        {abilityNames.map((ability, index) => {
          const abilityData = formData.abilities?.[index] || { baseScore: '8', featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 };
          const baseScore = parseInt(abilityData.baseScore) || 8;
          const backgroundIncrease = parseInt(abilityData.backgroundIncrease) || 0;
          const miscIncrease = parseInt(abilityData.miscIncrease) || 0;
          const featIncrease = getFeatIncreaseForAbility(ability);
          const racialIncrease = racialAbilityIncreases[ability] || 0;
          const isBackgroundAbilityScore = isBackgroundAbility(ability);
          const totalScore = baseScore + featIncrease + backgroundIncrease + miscIncrease + racialIncrease;
          const cost = pointBuyCosts[baseScore] || 0;

          return (
            <div key={ability} className={`ability-score-card ${isBackgroundAbilityScore ? 'bg-ability-score' : ''}`}>
              {isBackgroundAbilityScore && (
                <div className="bg-ability-badge">
                  <i className="fa-solid fa-star"></i> Background: +{backgroundIncrease}
                </div>
              )}
              {racialIncrease > 0 && (
                <div className="racial-increase-badge">
                  <i className="fa-solid fa-dragon"></i> Racial: +{racialIncrease}
                </div>
              )}
              {featIncrease > 0 && (
                <div className="feat-increase-badge">
                  <i className="fa-solid fa-dumbbell"></i> Feat: +{featIncrease}
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
                <label htmlFor={`misc-increase-${index}`}>Misc Increase</label>
                <input
                  id={`misc-increase-${index}`}
                  type="number"
                  value={abilityData.miscIncrease}
                  onChange={(e) => onAbilityMiscIncreaseChange(index, parseInt(e.target.value))}
                  className={errors[`ability_${index}_miscIncrease`] ? 'error' : ''}
                />
                {errors[`ability_${index}_miscIncrease`] && <span className="error-message">{errors[`ability_${index}_miscIncrease`]}</span>}
              </div>
              <div className={`total-score ${totalScore > effectiveAbilityScoreCap ? 'error' : ''}`}>
                Total: <strong>{totalScore}</strong>
                {totalScore > effectiveAbilityScoreCap && <span className="error-message"> (max {effectiveAbilityScoreCap})</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WizardStepAbilities;
