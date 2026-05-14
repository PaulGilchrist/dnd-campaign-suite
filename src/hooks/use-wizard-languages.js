import useWizardConfig from './useWizardConfig.js';
import { getLanguageLimits, getFightingStyleLimits, validateLanguagesAndFightingStyles } from '../services/languages-fightingstyles-validation.js';

function useWizardLanguages(formData) {
  const {
    languageLimits,
    fightingStyleLimits,
    warnings: languageWarnings,
    preSelectedLanguages,
    preSelectedFightingStyles,
  } = useWizardConfig({
    formData,
    validateFn: validateLanguagesAndFightingStyles,
    slots: [
      { get: getLanguageLimits, state: { initial: null, key: 'languageLimits' }, isLimit: true, preSelectedKey: 'preSelectedLanguages' },
      { get: getFightingStyleLimits, state: { initial: null, key: 'fightingStyleLimits' }, isLimit: true, preSelectedKey: 'preSelectedFightingStyles' },
    ],
    getDeps: (f) => [f.languages, f.class?.fightingStyles, f.class?.name, f.race?.name, f.background, f.rules, f.level],
  });

  return { languageLimits, fightingStyleLimits, languageWarnings, preSelectedLanguages, preSelectedFightingStyles };
}

export default useWizardLanguages;
