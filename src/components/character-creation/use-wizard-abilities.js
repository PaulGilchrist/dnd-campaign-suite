import { useEffect, useCallback } from 'react';
import { getPointBuyCosts } from './utils.js';

function useWizardAbilities(formData, currentStep, setErrors, updateAbility) {
  useEffect(() => {
    const validateAbilities = async () => {
      if (currentStep === 5) {
        const abilityErrors = {};
        const rules = await getPointBuyCosts(formData.rules || '5e');
        let totalPointsSpent = 0;

        formData.abilities.forEach((ability, index) => {
          const baseScore = parseInt(ability.baseScore) || 8;
          const improvements = parseInt(ability.abilityImprovements) || 0;
          const misc = parseInt(ability.miscBonus) || 0;
          const totalScore = baseScore + improvements + misc;

          const cost = rules[baseScore] || 0;
          totalPointsSpent += cost;

          if (baseScore < 8) {
            abilityErrors[`ability_${index}_baseScore`] = 'Base score must be at least 8';
           }
          if (baseScore > 15) {
            abilityErrors[`ability_${index}_baseScore`] = 'Base score cannot exceed 15 (point buy max)';
           }
          if (totalScore > 20) {
            abilityErrors[`ability_${index}_totalScore`] = `Total score (base + improvements + misc) cannot exceed 20`;
           }
          if (improvements < 0) {
            abilityErrors[`ability_${index}_abilityImprovements`] = 'Improvements must be 0 or above';
           }
          if (misc < 0) {
            abilityErrors[`ability_${index}_miscBonus`] = 'Misc bonus must be 0 or above';
           }
         });

        if (totalPointsSpent > 27) {
          abilityErrors.pointsExceeded = `You have spent ${totalPointsSpent} points. You only have 27 points to spend.`;
         }

        // Clear stale ability errors from previous validation
        const abilityErrorKeys = formData.abilities.flatMap((_, index) => [
          `ability_${index}_baseScore`,
          `ability_${index}_abilityImprovements`,
          `ability_${index}_miscBonus`,
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
   }, [formData.abilities, currentStep, formData.rules, setErrors]);

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

  const onAbilityBaseScoreChange = useCallback(async (index, value) => {
    const newBaseScore = parseInt(value) || 8;
    updateAbility(index, 'baseScore', newBaseScore);
  }, [updateAbility]);

  const onAbilityImprovementChange = useCallback((index, value) => {
    const improvements = parseInt(value) || 0;
    const ability = formData.abilities[index];
    const baseScore = parseInt(ability.baseScore) || 8;
    const misc = parseInt(ability.miscBonus) || 0;
    const totalScore = baseScore + improvements + misc;
    if (improvements < 0 || totalScore > 20) return;
    updateAbility(index, 'abilityImprovements', improvements);
  }, [formData.abilities, updateAbility]);

  const onAbilityMiscBonusChange = useCallback((index, value) => {
    const misc = parseInt(value) || 0;
    const ability = formData.abilities[index];
    const baseScore = parseInt(ability.baseScore) || 8;
    const improvements = parseInt(ability.abilityImprovements) || 0;
    const totalScore = baseScore + improvements + misc;
    if (misc < 0 || totalScore > 20) return;
    updateAbility(index, 'miscBonus', misc);
  }, [formData.abilities, updateAbility]);

  return {
    calculateTotalPointsSpent,
    onAbilityBaseScoreChange,
    onAbilityImprovementChange,
    onAbilityMiscBonusChange,
  };
}

export default useWizardAbilities;