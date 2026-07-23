import useWizardConfig from './useWizardConfig.js';
import { validateSkills, getSkillLimits, getExpertiseLimits, getPreSelectedSkills } from '../../services/character/skillValidation.js';

function useWizardSkills(formData, setFormData, allFeats) {
  const configResult = useWizardConfig({
    formData,
    setFormData,
    validateFn: (f) => validateSkills(f, allFeats),
    slots: [
       { get: (f) => getSkillLimits(f, allFeats), state: { initial: null, key: 'skillLimits' }, isLimit: true },
       { get: (f) => getExpertiseLimits(f, allFeats), state: { initial: null, key: 'expertiseLimits' }, isLimit: true },
     ],
    getDeps: (f) => [f.skillProficiencies, f.expertSkills, f.class?.name, f.race?.name, f.background, f.rules, f.level, f.feats],
    preSelect: {
      getFn: (f) => getPreSelectedSkills(f, allFeats),
      merge: (prev, items) => ({ ...prev, skillProficiencies: [...(prev.skillProficiencies || []), ...items.filter(s => !(prev.skillProficiencies || []).includes(s))] }),
      deps: (f) => [f.background, f.race?.name, f.class?.name, f.rules, f.feats],
      stateKey: 'preSelectedSkills',
     },
  });

  const { warnings, ...rest } = configResult;
  return { ...rest, skillWarnings: warnings };
}

export default useWizardSkills;
