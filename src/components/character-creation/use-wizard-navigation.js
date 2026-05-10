import { useState, useEffect, useCallback, useMemo } from 'react';
import { validateStep } from './utils.js';

function useWizardNavigation(initialStep, formData, racesData, classSubtypes, ruleset) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isNextDisabled, setIsNextDisabled] = useState(false);
  const [step2Valid, setStep2Valid] = useState(false);
  const step1Valid = !!ruleset;

  // Synchronous step 3 validity: checks race/class selection and subrace/subclass requirements
  // directly against formData and reference data. If reference data hasn't loaded yet for the
  // selected class/race, returns false — no async timing window to worry about.
  const step3Valid = useMemo(() => {
    if (!formData.race?.name) return false;
    if (!formData.class?.name) return false;

    const cls = classSubtypes.find(cs => cs.className === formData.class.name);
    if (!cls) return false;

    const race = racesData.find(r => r.name === formData.race.name);
    if (!race) return false;

    if (cls.subtypes?.length > 0 && !formData.class.subclass?.name) return false;
    if (race.subraces?.length > 0 && !formData.race.subrace?.name) return false;

    return true;
  }, [formData.race, formData.class, classSubtypes, racesData]);

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

  // Async validation of the current step — gates the "Next" button
  useEffect(() => {
    const checkValidation = async () => {
      const stepErrors = await validateStep(currentStep, formData, {}, racesData, classSubtypes, ruleset);
      setIsNextDisabled(Object.keys(stepErrors).length > 0);
    };
    checkValidation();
  }, [currentStep, formData, racesData, classSubtypes, ruleset]);

  // Async validation of step 2 — gates sidebar access to step 3+
  useEffect(() => {
    const checkStep2 = async () => {
      const step2Errors = await validateStep(2, formData, {}, racesData, classSubtypes, ruleset);
      setStep2Valid(Object.keys(step2Errors).length === 0);
    };
    checkStep2();
  }, [formData, racesData, classSubtypes, ruleset]);

  const getStepEnabled = useMemo(() => {
    return (targetStep) => {
      if (targetStep === 1) return true;
      if (targetStep === 2) return step1Valid;
      if (targetStep === 3) return step1Valid && step2Valid;
      return step1Valid && step2Valid && step3Valid;
    };
  }, [step1Valid, step2Valid, step3Valid]);

  const isSaveEnabled = useMemo(() => step1Valid && step2Valid && step3Valid, [step1Valid, step2Valid, step3Valid]);

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
