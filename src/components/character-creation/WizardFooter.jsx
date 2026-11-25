import { getLadderCauseTitle } from '../../config/steps-config.js';

function WizardFooter({ 
  isFirstStep, 
  isLastStep, 
  onCancel, 
  onPrevious, 
  onNext, 
  onSubmit,
  isEditing = false,
  isNextDisabled = false,
  // Edit-mode submit gate — the EXACT value the sidebar ✓ Save is gated by
  // (ladder prefix + ability caps + feat/skill selection caps), passed down
  // from CharacterCreationWizard so the two controls can never disagree.
  isSaveEnabled = true,
  ruleset,
  firstInvalidStep = null
}) {
  return (
     <div className="wizard-footer">
       {/* Cancel must be clickable on the first step — the wizard's
           unsaved-changes guard (CharacterCreationWizard handleRequestClose)
           decides whether closing prompts or happens silently. */}
       <button 
        className="btn btn-secondary" 
        onClick={isFirstStep ? onCancel : onPrevious}
       >
         {isFirstStep ? 'Cancel' : 'Previous'}
       </button>
      
       {isLastStep ? (
         isEditing ? (
           // The footer twin of the sidebar ✓ Save: same onSubmit handler,
           // same disabled gate, same cause-naming title (the ladder cause
           // stays silent on a caps-only disablement — sidebar parity).
           <button 
             className="btn btn-success" 
             onClick={onSubmit}
             disabled={!isSaveEnabled}
             title={!isSaveEnabled ? getLadderCauseTitle(firstInvalidStep, { ruleset }) : undefined}
           >
             Save Changes
           </button>
         ) : (
           <button className="btn btn-success" onClick={onSubmit}>
             Create Character
           </button>
         )
       ) : (
         <button className="btn btn-primary" onClick={onNext} disabled={isNextDisabled}>
          Next
         </button>
       )}
     </div>
   );
}

export default WizardFooter;
