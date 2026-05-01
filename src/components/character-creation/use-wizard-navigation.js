import { useState, useEffect, useCallback } from 'react';
import { validateStep } from './utils';

function useWizardNavigation(initialStep, formData, racesData, classSubtypes, ruleset) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isNextDisabled, setIsNextDisabled] = useState(false);

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

  return {
    currentStep,
    isNextDisabled,
    navigateNext,
    navigatePrevious,
    goToStep,
    setCurrentStep,
    };
}

export default useWizardNavigation;