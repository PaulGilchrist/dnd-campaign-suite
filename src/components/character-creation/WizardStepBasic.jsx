import { useState, useEffect } from 'react';

function WizardStepBasic({ formData, errors, campaignName, onInputChange }) {
  const [alignments, setAlignments] = useState([]);

  useEffect(() => {
    fetch('/data/alignments.json')
      .then(response => response.json())
      .then(data => setAlignments(data))
      .catch(error => console.error('Error loading alignments:', error));
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      onInputChange('image', event.target.result);
      onInputChange('imageName', file.name);
    };
    reader.readAsDataURL(file);
  };

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
       
        <div className="form-group">
          <label>Character Picture</label>
          <input
           type="file"
           id="character-image-upload"
           accept="image/*"
           className="image-upload-input"
           onChange={handleImageUpload}
          />
           <div className="image-preview">
             {formData.image ? (
               <img src={formData.image} alt="Character" />
             ) : formData.imagePath ? (
               <img src={formData.imagePath && formData.imagePath.startsWith('http') ? formData.imagePath : (campaignName ? `campaigns/${campaignName}/${formData.imagePath}` : formData.imagePath)} alt="Character" />
             ) : (
              <span>Click to upload</span>
            )}
          </div>
          {(formData.image || formData.imagePath) && (
            <button
              type="button"
              className="btn-remove-image"
              onClick={() => {
                onInputChange('image', '');
                onInputChange('imagePath', '');
              }}
            >
              Remove Image
            </button>
          )}
        </div>
      </div>
  );
}

export default WizardStepBasic;
