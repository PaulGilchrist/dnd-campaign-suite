import useWizardConfig from './useWizardConfig.js';

function getPreSelectedAbilityScore(formData) {
  if (!formData.background || formData.rules !== '2024') return null;

  const abilityKey = `_bg_ability_${formData.background}`;
  const stored = localStorage.getItem(abilityKey);
  if (stored) {
    return stored;
  }
  return null;
}

function setPreSelectedAbilityScore(formData, chosenAbility) {
  if (!formData.background || formData.rules !== '2024') return;

  const abilityKey = `_bg_ability_${formData.background}`;
  if (chosenAbility) {
    localStorage.setItem(abilityKey, chosenAbility);
  } else {
    localStorage.removeItem(abilityKey);
  }
}

function useWizardBackgroundAbility(formData, setFormData) {
  const { preSelectedBackgroundAbility } = useWizardConfig({
    formData,
    setFormData,
    validateFn: () => [],
    slots: [],
    getDeps: (f) => [f.background, f.rules],
    preSelect: {
      getFn: async (f) => {
        if (!f.background || f.rules !== '2024') return null;
        return getPreSelectedAbilityScore(f);
      },
      deps: (f) => [f.background, f.rules],
      stateKey: 'preSelectedBackgroundAbility'
    }
  });

  const chooseAbility = (abilityName) => {
    setPreSelectedAbilityScore(formData, abilityName);
    setFormData((prev) => {
      const abilities = (prev.abilities || []).map((ability) => {
        if (ability.name === abilityName) {
          return { ...ability, miscBonus: (ability.miscBonus || 0) + 1 };
        }
        return ability;
      });
      return { ...prev, abilities };
    });
  };

  const removeAbility = (abilityName) => {
    setPreSelectedAbilityScore(formData, null);
    setFormData((prev) => {
      const abilities = (prev.abilities || []).map((ability) => {
        if (ability.name === abilityName) {
          return { ...ability, miscBonus: Math.max(0, (ability.miscBonus || 0) - 1) };
        }
        return ability;
      });
      return { ...prev, abilities };
    });
  };

  return {
    preSelectedBackgroundAbility,
    chooseAbility,
    removeAbility,
  };
}

export default useWizardBackgroundAbility;
