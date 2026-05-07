import { useState, useEffect } from 'react';

function WizardStepBasic({ formData, errors, backgrounds, ruleset, onInputChange }) {
  const [alignments, setAlignments] = useState([]);

  useEffect(() => {
    fetch('/data/alignments.json')
      .then(response => response.json())
      .then(data => setAlignments(data))
      .catch(error => console.error('Error loading alignments:', error));
  }, []);

  return (
     <div className="wizard-step">
       <h2>Step 2: Basic Information</h2>
      
       <div className="form-group">
         <label>Character Name *</label>
         <input
          type="text"
          value={formData.name}
          onChange={(e) => onInputChange('name', e.target.value)}
          className={errors.name ? 'error' : ''}
         />
         {errors.name && <span className="error-message">{errors.name}</span>}
       </div>
      
       <div className="form-group">
         <label>Level *</label>
         <input
          type="number"
          min="1"
          max="20"
          value={formData.level}
          onChange={(e) => onInputChange('level', parseInt(e.target.value))}
          className={errors.level ? 'error' : ''}
         />
         {errors.level && <span className="error-message">{errors.level}</span>}
       </div>
      
       <div className="form-group">
         <label>Alignment *</label>
         <select
          value={formData.alignment}
          onChange={(e) => onInputChange('alignment', e.target.value)}
          className={errors.alignment ? 'error' : ''}
         >
           {alignments.map(alignment => (
             <option key={alignment} value={alignment}>{alignment}</option>
           ))}
         </select>
         {errors.alignment && <span className="error-message">{errors.alignment}</span>}
       </div>
      
      {ruleset === '2024' && (
        <div className="form-group">
          <label>Background (2024 Rules)</label>
          <select
            value={formData.background}
            onChange={(e) => onInputChange('background', e.target.value)}
            className={errors.background ? 'error' : ''}
          >
            <option value="">Select a background</option>
            {backgrounds.map(background => (
              <option key={background.index} value={background.name}>{background.name}</option>
            ))}
          </select>
          {errors.background && <span className="error-message">{errors.background}</span>}
        </div>
      )}
    </div>
  );
}

export default WizardStepBasic;
