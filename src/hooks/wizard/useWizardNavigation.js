import { useState, useEffect, useCallback, useMemo } from 'react';
import { validateStep } from '../../config/utils.js';
import { getVisibleSteps } from '../../config/steps-config.js';

function useWizardNavigation(initialStep, formData, racesData, { classSubtypes = [], ruleset, allFeats = [], existingNames = [] } = {}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isNextDisabled, setIsNextDisabled] = useState(false);
  const [step2Valid, setStep2Valid] = useState(false);
  const step1Valid = !!ruleset;

  const step3Valid = useMemo(() => {
    return !!(formData.race && formData.race.name);
  }, [formData.race]);

  const step4Valid = useMemo(() => {
    if (!formData.race?.name) return false;
    const race = racesData.find(r => r.name === formData.race.name);
    if (!race) return false;
    const subraces = race.subraces || [];
    if (subraces.length === 0) return true;
    return !!(formData.race.subrace && formData.race.subrace.name);
  }, [formData.race, racesData]);

  const step5Valid = useMemo(() => {
    if (ruleset !== '2024') return true;
    return !!formData.background;
  }, [formData.background, ruleset]);

  const step6Valid = useMemo(() => {
    return !!(formData.class && formData.class.name);
  }, [formData.class]);

  const step7Valid = useMemo(() => {
    if (!formData.class?.name) return false;
    const cls = classSubtypes.find(cs => cs.className === formData.class.name);
    if (!cls) return false;
    const subclasses = cls.subtypes || [];
    if (subclasses.length === 0) return true;
    const chosen = formData.class.subclass?.name || '';
    // Membership in the CURRENT ruleset's list — not just "any non-empty
    // name": a ruleset switch keeps the class choice but the same class can
    // print its subclasses under different names ('Abjurer' vs 'Abjuration'),
    // and the new-ruleset engine cannot resolve a stale one. The switch's
    // ledger copy already says every step gets re-confirmed; this is the
    // gate that makes the save wait for that re-confirmation.
    return subclasses.some(s => (typeof s === 'string' ? s : s?.name) === chosen);
  }, [formData.class, classSubtypes]);

  // Walk order = the same shared step index the sidebar and content headings
  // use, so Next/Back never land on a step the indicator omits.
  const walkSteps = useMemo(() => getVisibleSteps({ ruleset }).map(s => s.step), [ruleset]);

  const navigateNext = useCallback(async () => {
    const stepErrors = await validateStep(currentStep, formData, { racesData, classSubtypes, ruleset, allFeats, existingNames });
    if (Object.keys(stepErrors).length === 0) {
      setCurrentStep(prev => {
        const idx = walkSteps.indexOf(prev);
        return idx >= 0 && idx < walkSteps.length - 1 ? walkSteps[idx + 1] : prev;
      });
      return true;
    }
    return false;
  }, [currentStep, formData, racesData, classSubtypes, ruleset, allFeats, existingNames, walkSteps]);

  const navigatePrevious = useCallback(() => {
    setCurrentStep(prev => {
      const idx = walkSteps.indexOf(prev);
      return idx > 0 ? walkSteps[idx - 1] : prev;
    });
  }, [walkSteps]);

  const goToStep = useCallback((step) => {
    setCurrentStep(step);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkValidation = async () => {
      const stepErrors = await validateStep(currentStep, formData, { racesData, classSubtypes, ruleset, allFeats, existingNames });
      if (!cancelled) {
        setIsNextDisabled(Object.keys(stepErrors).length > 0);
      }
    };
    checkValidation();
    return () => { cancelled = true; };
  }, [currentStep, formData, racesData, classSubtypes, ruleset, allFeats, existingNames]);

  useEffect(() => {
    let cancelled = false;
    const checkStep2 = async () => {
      const step2Errors = await validateStep(2, formData, { racesData, classSubtypes, ruleset, existingNames });
      if (!cancelled) {
        setStep2Valid(Object.keys(step2Errors).length === 0);
      }
    };
    checkStep2();
    return () => { cancelled = true; };
  }, [formData, racesData, classSubtypes, ruleset, existingNames]);

  const validPrefixes = useMemo(() => {
    const stepValidities = [step1Valid, step2Valid, step3Valid, step4Valid, step5Valid, step6Valid, step7Valid];
    const prefixes = [true];
    stepValidities.reduce((allValidSoFar, valid, index) => {
      prefixes[index + 1] = allValidSoFar && valid;
      return prefixes[index + 1];
    }, true);
    return prefixes;
  }, [step1Valid, step2Valid, step3Valid, step4Valid, step5Valid, step6Valid, step7Valid]);

  const getStepEnabled = useMemo(() => {
    return (targetStep) => {
      const prefix = Number.isInteger(targetStep) ? validPrefixes[targetStep - 1] : undefined;
      return prefix === undefined ? validPrefixes[validPrefixes.length - 1] : prefix;
    };
  }, [validPrefixes]);

  const isSaveEnabled = validPrefixes[validPrefixes.length - 1];

  return {
    currentStep,
    isNextDisabled,
    navigateNext,
    navigatePrevious,
    goToStep,
    setCurrentStep,
    getStepEnabled,
    isSaveEnabled,
  };
}

export default useWizardNavigation;
