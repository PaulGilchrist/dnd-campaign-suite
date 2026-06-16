import useWizardConfig from './useWizardConfig.js';
import { validateSkills, getSkillLimits, getExpertiseLimits, getPreSelectedSkills } from '../../services/character/skillValidation.js';

function useWizardSkills(formData, setFormData) {
  const configResult = useWizardConfig({
    formData,
    setFormData,
    validateFn: validateSkills,
    slots: [
       { get: getSkillLimits, state: { initial: null, key: 'skillLimits' }, isLimit: true },
       { get: getExpertiseLimits, state: { initial: null, key: 'expertiseLimits' }, isLimit: true },
     ],
    getDeps: (f) => [f.skillProficiencies, f.expertSkills, f.class?.name, f.race?.name, f.background, f.rules, f.level],
    preSelect: {
      getFn: getPreSelectedSkills,
      merge: (prev, items) => ({ ...prev, skillProficiencies: [...(prev.skillProficiencies || []), ...items.filter(s => !(prev.skillProficiencies || []).includes(s))] }),
      deps: (f) => [f.background, f.race?.name, f.class?.name, f.rules],
      stateKey: 'preSelectedSkills',
     },
   });

  const { warnings, ...rest } = configResult;
  return { ...rest, skillWarnings: warnings };
}

export default useWizardSkills;
