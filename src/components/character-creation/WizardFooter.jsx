
function WizardFooter({ 
  isFirstStep, 
  isLastStep, 
  onCancel, 
  onPrevious, 
  onNext, 
  onSubmit,
  isEditing = false,
  isNextDisabled = false
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
         <button className="btn btn-success" onClick={onSubmit}>
           {isEditing ? 'Save Changes' : 'Create Character'}
         </button>
       ) : (
         <button className="btn btn-primary" onClick={onNext} disabled={isNextDisabled}>
          Next
         </button>
       )}
     </div>
   );
}

export default WizardFooter;
