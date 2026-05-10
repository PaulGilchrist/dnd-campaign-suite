import { useState, useEffect, useCallback, useMemo } from 'react';
import { validateStep } from './utils.js';

function useWizardNavigation(initialStep, formData, racesData, classSubtypes, ruleset) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isNextDisabled, setIsNextDisabled] = useState(false);
  const [step2Valid, setStep2Valid] = useState(false);
  const [step3Valid, setStep3Valid] = useState(false);

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
    const checkRequiredSteps = async () => {
      const step2Errors = await validateStep(2, formData, {}, racesData, classSubtypes, ruleset);
      const step3Errors = await validateStep(3, formData, {}, racesData, classSubtypes, ruleset);
      setStep2Valid(Object.keys(step2Errors).length === 0);
      setStep3Valid(Object.keys(step3Errors).length === 0);
    };
    checkRequiredSteps();
  }, [formData, racesData, classSubtypes, ruleset]);

  const getStepEnabled = useMemo(() => {
    return (targetStep) => {
      if (targetStep <= 3) return true;
      return step3Valid;
    };
  }, [step3Valid]);

  const isSaveEnabled = useMemo(() => step3Valid, [step3Valid]);

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
