import { useEffect, useCallback } from 'react';
import { getPointBuyCosts } from './utils';

function useWizardAbilities(formData, currentStep, setErrors) {
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

        setErrors(prev => ({ ...prev, ...abilityErrors }));
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

  return {
    calculateTotalPointsSpent,
      };
}

export default useWizardAbilities;