import { useState, useEffect, useCallback, useMemo } from 'react';
import { validateStep } from '../../config/utils.js';

function useWizardNavigation(initialStep, formData, racesData, classSubtypes, ruleset) {
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
    return !!(formData.class.subclass && formData.class.subclass.name);
  }, [formData.class, classSubtypes]);

  const navigateNext = useCallback(async () => {
    const stepErrors = await validateStep(currentStep, formData, {}, racesData, classSubtypes, ruleset);
    if (Object.keys(stepErrors).length === 0) {
      setCurrentStep(prev => prev + 1);
      return true;
    }
    return false;
  }, [currentStep, formData, racesData, classSubtypes, ruleset]);

  const navigatePrevious = useCallback(() => {
    setCurrentStep(prev => prev - 1);
  }, []);

  const goToStep = useCallback((step) => {
    setCurrentStep(step);
  }, []);

  useEffect(() => {
    const checkValidation = async () => {
      const stepErrors = await validateStep(currentStep, formData, {}, racesData, classSubtypes, ruleset);
      setIsNextDisabled(Object.keys(stepErrors).length > 0);
    };
    checkValidation();
  }, [currentStep, formData, racesData, classSubtypes, ruleset]);

  useEffect(() => {
    const checkStep2 = async () => {
      const step2Errors = await validateStep(2, formData, {}, racesData, classSubtypes, ruleset);
      setStep2Valid(Object.keys(step2Errors).length === 0);
    };
    checkStep2();
  }, [formData, racesData, classSubtypes, ruleset]);

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
