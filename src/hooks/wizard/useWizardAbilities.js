import { useEffect, useCallback } from 'react';
import { getPointBuyCosts, getPointBuyCostsSync } from '../../config/utils.js';
import { computeRaceBuffs } from '../../services/character/raceBuffService.js';
import { loadValidationRules } from '../../services/ui/dataLoader.js';

function useWizardAbilities(formData, currentStep, setErrors, updateAbility) {
  const { rules: ruleset, race, abilities } = formData;

  useEffect(() => {
    if (ruleset !== '5e' || !race?.name) {
      return;
    }
    const raceBuffs = computeRaceBuffs(race, { race: { subrace: race.subrace }, rules: ruleset }, '5e');
    const subraceBuffs = race.subrace?.name
      ? computeRaceBuffs(race, { race: { subrace: { name: race.subrace.name } } }, '5e')
      : { abilityScoreIncreases: [] };
    abilities.forEach((ability, index) => {
      const abilityBuffs = raceBuffs.abilityScoreIncreases.filter(b => b.name === ability.name);
      const subraceAbilityBuffs = subraceBuffs.abilityScoreIncreases.filter(b => b.name === ability.name);
      const racialIncrease = abilityBuffs.reduce((sum, b) => sum + b.amount, 0) + subraceAbilityBuffs.reduce((sum, b) => sum + b.amount, 0);
      if (racialIncrease !== (ability.racialIncrease || 0)) {
        updateAbility(index, 'racialIncrease', racialIncrease);
      }
    });
  }, [race, ruleset, abilities, updateAbility]);

  useEffect(() => {
    const validateAbilities = async () => {
      if (currentStep === 5) {
        const abilityErrors = {};
        const rules = await getPointBuyCosts(ruleset || '5e');
        const rulesData = await loadValidationRules(ruleset || '5e');
        const maxPoints = rulesData?.point_buy?.total_points ?? 27;
        let totalPointsSpent = 0;

        abilities.forEach((ability, index) => {
          const baseScore = parseInt(ability.baseScore) || 8;
          const featIncrease = parseInt(ability.featIncrease) || 0;
          const bgIncrease = parseInt(ability.backgroundIncrease) || 0;
          const misc = parseInt(ability.miscIncrease) || 0;
          
          let racialIncrease = 0;
          if (ruleset === '5e' && race?.name) {
            const raceBuffs = computeRaceBuffs(race, { race: { subrace: race.subrace }, rules: ruleset }, '5e');
            const abilityBuffs = raceBuffs.abilityScoreIncreases.filter(b => b.name === ability.name);
            racialIncrease = abilityBuffs.reduce((sum, b) => sum + b.amount, 0);
            if (race.subrace?.name) {
              const subraceBuffs = computeRaceBuffs(race, { race: { subrace: { name: race.subrace.name } } }, '5e');
              const subraceAbilityBuffs = subraceBuffs.abilityScoreIncreases.filter(b => b.name === ability.name);
              racialIncrease += subraceAbilityBuffs.reduce((sum, b) => sum + b.amount, 0);
            }
          }
          
          const totalScore = baseScore + featIncrease + bgIncrease + misc + racialIncrease;

          const cost = rules[baseScore] || 0;
          totalPointsSpent += cost;

          if (baseScore < 8) {
            abilityErrors[`ability_${index}_baseScore`] = 'Base score must be at least 8';
           }
          if (baseScore > 15) {
            abilityErrors[`ability_${index}_baseScore`] = 'Base score cannot exceed 15 (point buy max)';
           }
          if (totalScore > 20) {
            abilityErrors[`ability_${index}_totalScore`] = `Total score (base + feat + background + racial + misc) cannot exceed 20`;
           }
          if (misc < 0) {
            abilityErrors[`ability_${index}_miscIncrease`] = 'Misc bonus must be 0 or above';
           }
          });

        if (totalPointsSpent > maxPoints) {
          abilityErrors.pointsExceeded = `You have spent ${totalPointsSpent} points. You only have ${maxPoints} points to spend.`;
         }

        // Clear stale ability errors from previous validation
        const abilityErrorKeys = abilities.flatMap((_, index) => [
          `ability_${index}_baseScore`,
          `ability_${index}_miscIncrease`,
          `ability_${index}_totalScore`,
        ]).concat('pointsExceeded');

        setErrors(prev => {
          const cleaned = { ...prev };
          abilityErrorKeys.forEach(key => delete cleaned[key]);
          return { ...cleaned, ...abilityErrors };
        });
       }
    };

    validateAbilities();
   }, [abilities, currentStep, ruleset, race, setErrors]);

  const calculateTotalPointsSpent = useCallback(async (abilities, newIndex, newBaseScore) => {
    const rules = await getPointBuyCosts(formData.rules || '5e');
    return abilities.reduce((sum, ability, i) => {
      if (i === newIndex) {
        return sum + (rules[newBaseScore] || 0);
       }
      const baseScore = parseInt(ability.baseScore) || 8;
      return sum + (rules[baseScore] || 0);
     }, 0);
   }, [formData.rules]);

  const onAbilityBaseScoreChange = useCallback((index, value) => {
    const newBaseScore = parseInt(value) || 8;
    if (newBaseScore < 8 || newBaseScore > 15) {
      return;
    }
    const rules = getPointBuyCostsSync(formData.rules || '5e');
    const maxPoints = 27;
    const newTotalSpent = abilities.reduce((sum, ability, i) => {
      if (i === index) {
        return sum + (rules[newBaseScore] || 0);
       }
      const baseScore = parseInt(ability.baseScore) || 8;
      return sum + (rules[baseScore] || 0);
     }, 0);
    if (newTotalSpent > maxPoints) {
      return;
    }
    updateAbility(index, 'baseScore', newBaseScore);
  }, [abilities, formData.rules, updateAbility]);

  const onAbilityMiscIncreaseChange = useCallback((index, value) => {
    const misc = parseInt(value) || 0;
    const ability = abilities[index];
    const baseScore = parseInt(ability.baseScore) || 8;
    const featIncrease = parseInt(ability.featIncrease) || 0;
    const bgIncrease = parseInt(ability.backgroundIncrease) || 0;
    
    let racialIncrease = 0;
    if (ruleset === '5e' && race?.name) {
      const raceBuffs = computeRaceBuffs(race, { race: { subrace: race.subrace }, rules: ruleset }, '5e');
      const abilityBuffs = raceBuffs.abilityScoreIncreases.filter(b => b.name === ability.name);
      racialIncrease = abilityBuffs.reduce((sum, b) => sum + b.amount, 0);
      if (race.subrace?.name) {
        const subraceBuffs = computeRaceBuffs(race, { race: { subrace: { name: race.subrace.name } } }, '5e');
        const subraceAbilityBuffs = subraceBuffs.abilityScoreIncreases.filter(b => b.name === ability.name);
        racialIncrease += subraceAbilityBuffs.reduce((sum, b) => sum + b.amount, 0);
      }
    }
    
    const totalScore = baseScore + featIncrease + bgIncrease + misc + racialIncrease;
    if (misc < 0 || totalScore > 20) return;
    updateAbility(index, 'miscIncrease', misc);
  }, [abilities, ruleset, race, updateAbility]);

  return {
    calculateTotalPointsSpent,
    onAbilityBaseScoreChange,
    onAbilityMiscIncreaseChange,
  };
}

export default useWizardAbilities;
