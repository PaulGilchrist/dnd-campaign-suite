import { useEffect, useCallback } from 'react';
import { getPointBuyCosts } from '../../config/utils.js';

function useWizardAbilities(formData, currentStep, setErrors, updateAbility) {
  useEffect(() => {
    const validateAbilities = async () => {
      if (currentStep === 5) {
        const abilityErrors = {};
        const rules = await getPointBuyCosts(formData.rules || '5e');
        let totalPointsSpent = 0;

        formData.abilities.forEach((ability, index) => {
          const baseScore = parseInt(ability.baseScore) || 8;
          const featIncrease = parseInt(ability.featIncrease) || 0;
          const bgIncrease = parseInt(ability.backgroundIncrease) || 0;
          const misc = parseInt(ability.miscIncrease) || 0;
          const totalScore = baseScore + featIncrease + bgIncrease + misc;

          const cost = rules[baseScore] || 0;
          totalPointsSpent += cost;

          if (baseScore < 8) {
            abilityErrors[`ability_${index}_baseScore`] = 'Base score must be at least 8';
           }
          if (baseScore > 15) {
            abilityErrors[`ability_${index}_baseScore`] = 'Base score cannot exceed 15 (point buy max)';
           }
          if (totalScore > 20) {
            abilityErrors[`ability_${index}_totalScore`] = `Total score (base + feat + background + misc) cannot exceed 20`;
           }
          if (misc < 0) {
            abilityErrors[`ability_${index}_miscIncrease`] = 'Misc bonus must be 0 or above';
           }
          });

        if (totalPointsSpent > 27) {
          abilityErrors.pointsExceeded = `You have spent ${totalPointsSpent} points. You only have 27 points to spend.`;
         }

        // Clear stale ability errors from previous validation
        const abilityErrorKeys = formData.abilities.flatMap((_, index) => [
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

  const onAbilityMiscIncreaseChange = useCallback((index, value) => {
    const misc = parseInt(value) || 0;
    const ability = formData.abilities[index];
    const baseScore = parseInt(ability.baseScore) || 8;
    const featIncrease = parseInt(ability.featIncrease) || 0;
    const bgIncrease = parseInt(ability.backgroundIncrease) || 0;
    const totalScore = baseScore + featIncrease + bgIncrease + misc;
    if (misc < 0 || totalScore > 20) return;
    updateAbility(index, 'miscIncrease', misc);
  }, [formData.abilities, updateAbility]);

  return {
    calculateTotalPointsSpent,
    onAbilityBaseScoreChange,
    onAbilityMiscIncreaseChange,
  };
}

export default useWizardAbilities;
