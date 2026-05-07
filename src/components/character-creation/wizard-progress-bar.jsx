
function WizardProgressBar({ currentStep, totalSteps, isEditing }) {
  const effectiveStep = isEditing ? currentStep - 1 : currentStep;
  const effectiveTotal = isEditing ? totalSteps - 1 : totalSteps;
  const progressWidth = ((effectiveStep - 1) / (effectiveTotal - 1)) * 100;
  
  return (
    <div className="progress-bar">
      <div 
        className="progress-fill" 
        style={{ '--progress-width': `${progressWidth}%` }}
      ></div>
    </div>
  );
}

export default WizardProgressBar;
