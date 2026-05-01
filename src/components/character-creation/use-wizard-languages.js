import { useState, useEffect } from 'react';
import { getLanguageLimits, getFightingStyleLimits, validateLanguagesAndFightingStyles } from '../../services/languages-fightingstyles-validation.js';

function useWizardLanguages(formData) {
  const [languageLimits, setLanguageLimits] = useState(null);
  const [fightingStyleLimits, setFightingStyleLimits] = useState(null);
  const [languageWarnings, setLanguageWarnings] = useState([]);
  const [preSelectedLanguages, setPreSelectedLanguages] = useState([]);
  const [preSelectedFightingStyles, setPreSelectedFightingStyles] = useState([]);

  useEffect(() => {
    const validate = async () => {
      try {
        const langLimits = await getLanguageLimits(formData);
        const styleLimits = await getFightingStyleLimits(formData);
        const warnings = await validateLanguagesAndFightingStyles(formData);
        setLanguageLimits(langLimits);
        setFightingStyleLimits(styleLimits);
        setLanguageWarnings(warnings);
        setPreSelectedLanguages(langLimits?.preSelected || []);
        setPreSelectedFightingStyles(styleLimits?.preSelected || []);
          } catch (error) {
        console.error('Error validating languages and fighting styles:', error);
            }
          };

    validate();
      }, [formData.languages, formData.class?.fightingStyles, formData.class?.name, formData.race?.name, formData.background, formData.rules, formData.level]);

  return {
    languageLimits,
    fightingStyleLimits,
    languageWarnings,
    preSelectedLanguages,
    preSelectedFightingStyles,
     };
}

export default useWizardLanguages;