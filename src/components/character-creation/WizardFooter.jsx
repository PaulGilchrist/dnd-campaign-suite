
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
       <button 
        className="btn btn-secondary" 
        onClick={isFirstStep ? onCancel : onPrevious}
        disabled={isFirstStep}
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
