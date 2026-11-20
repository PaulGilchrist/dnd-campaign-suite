
// The step index is shared with the sidebar/headings (getVisibleSteps): the
// Ruleset step counts in BOTH flows, so the bar needs no editing offset —
// editing only changes the arrival step.
function WizardProgressBar({ currentStep, totalSteps }) {
  const progressWidth = ((currentStep - 1) / (totalSteps - 1)) * 100;
  
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
