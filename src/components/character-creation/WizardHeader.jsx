
function WizardHeader({ title, onClose }) {
  return (
    <div className="wizard-header">
      <h2>{title}</h2>
      <button className="close-btn" onClick={onClose}>×</button>
    </div>
  );
}

export default WizardHeader;
