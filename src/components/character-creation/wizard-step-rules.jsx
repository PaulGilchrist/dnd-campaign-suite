

function WizardStepRules({ ruleset, errors, onRulesetChange }) {
  return (
    <div className="wizard-step">
      <h2>Select Rules System</h2>
      <p className="step-description">Choose which D&D ruleset your character will follow:</p>
      
      <div className="rules-selection-container">
        <div 
          className={`rules-option ${ruleset === '5e' ? 'selected' : ''}`}
          onClick={() => onRulesetChange('5e')}
        >
          <div className="rules-option-icon">📜</div>
          <h3>5th Edition (5e)</h3>
          <p>The classic D&D ruleset from 2014. Features traditional spell slots, class features, and ability scores.</p>
          <ul className="rules-features">
            <li>Traditional spell slots</li>
            <li>Classic class features</li>
            <li>Standard ability improvements</li>
            <li>Original subclass system</li>
          </ul>
        </div>
        
        <div 
          className={`rules-option ${ruleset === '2024' ? 'selected' : ''}`}
          onClick={() => onRulesetChange('2024')}
        >
          <div className="rules-option-icon">✨</div>
          <h3>2024 Rules (Essentials)</h3>
          <p>The updated D&D ruleset with streamlined mechanics and modernized features.</p>
          <ul className="rules-features">
            <li>Revised spell mechanics</li>
            <li>Updated class features</li>
            <li>Improved ability improvements</li>
            <li>Modern subclass system</li>
          </ul>
        </div>
      </div>
      
      {errors.ruleset && <span className="error-message">{errors.ruleset}</span>}
    </div>
  );
}

export default WizardStepRules;
