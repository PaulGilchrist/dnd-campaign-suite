
function WizardHeader({ title, onClose }) {
  return (
    <div className="wizard-header">
      <h2>{title}</h2>
      <button className="close-btn" onClick={onClose} aria-label="Close character wizard">×</button>
    </div>
  );
}

export default WizardHeader;
