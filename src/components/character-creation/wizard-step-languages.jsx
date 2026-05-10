import { useState, useEffect, useMemo } from 'react';
import WarningList from '../common/warning-list.jsx';

function WizardStepLanguages({ formData, errors, onLanguageToggle, onFightingStyleToggle, languageLimits, fightingStyleLimits, warnings, preSelectedLanguages, preSelectedFightingStyles }) {
  const [languagesList, setLanguagesList] = useState([]);
  const [fightingStylesList, setFightingStylesList] = useState([]);
  const fightingStyles = useMemo(() => formData.class?.fightingStyles || [], [formData.class]);
  const languages = useMemo(() => formData.languages || [], [formData.languages]);

  useEffect(() => {
    fetch('/data/languages.json')
         .then(response => response.json())
         .then(data => setLanguagesList(data))
         .catch(error => console.error('Error loading languages:', error));
   }, []);

  useEffect(() => {
    fetch('/data/fighting-styles.json')
         .then(response => response.json())
         .then(data => setFightingStylesList(data))
         .catch(error => console.error('Error loading fighting styles:', error));
   }, []);

   // Auto-select pre-selected languages when languageLimits changes
  useEffect(() => {
    if (languageLimits && languageLimits.preSelected) {
      languageLimits.preSelected.forEach(lang => {
        if (!languages.includes(lang)) {
          onLanguageToggle(lang);
         }
       });
     }
     }, [languageLimits, languages, onLanguageToggle]);

   // Auto-select pre-selected fighting styles when fightingStyleLimits changes
  useEffect(() => {
    if (fightingStyleLimits && fightingStyleLimits.preSelected) {
      fightingStyleLimits.preSelected.forEach(style => {
        if (!fightingStyles.includes(style)) {
          onFightingStyleToggle(style);
         }
       });
     }
     }, [fightingStyleLimits, fightingStyles, onFightingStyleToggle]);

  const isLanguagePreSelected = (language) => (preSelectedLanguages || []).includes(language);
  const isFightingStylePreSelected = (style) => (preSelectedFightingStyles || []).includes(style);

  return (
     <div className="wizard-step">
       <h2>Step 7: Languages & Fighting Styles</h2>

       {/* Display language limits info */}
       {languageLimits && (
         <div className="rule-info">
           <p><strong>Rules:</strong> {languageLimits.details}</p>
             <p>You have selected {languages.length} of {languageLimits.allowed} allowed language(s).</p>
         </div>
       )}

       {/* Display fighting style limits info */}
       {fightingStyleLimits && (
         <div className="rule-info">
           <p><strong>Rules:</strong> {fightingStyleLimits.details}</p>
           <p>You have selected {fightingStyles.length} of {fightingStyleLimits.allowed} allowed fighting style(s).</p>
         </div>
       )}

        {/* Display warnings if any */}
        {warnings && warnings.length > 0 && <WarningList warnings={warnings} />}

       <div className="form-group">
         <label>Languages</label>
         <div className="multi-select-container multi-select-compact">
           {languagesList.map(language => (
             <label 
              key={language} 
               className={`multi-select-item ${languages.includes(language) ? 'selected' : ''} ${isLanguagePreSelected(language) ? 'pre-selected' : ''}`}
             >
               <input
                type="checkbox"
                 checked={languages.includes(language)}
                onChange={() => onLanguageToggle(language)}
                 disabled={isLanguagePreSelected(language) && languages.includes(language)}
               />
               &nbsp;{language}
             </label>
           ))}
         </div>
         {errors.languages && <span className="error-message">{errors.languages}</span>}
       </div>

       <div className="form-group">
         <label>Fighting Styles</label>
         <div className="multi-select-container multi-select-compact">
           {fightingStylesList.map(style => (
             <label 
              key={style} 
              className={`multi-select-item ${fightingStyles.includes(style) ? 'selected' : ''} ${isFightingStylePreSelected(style) ? 'pre-selected' : ''}`}
             >
               <input
                type="checkbox"
                checked={fightingStyles.includes(style)}
                onChange={() => onFightingStyleToggle(style)}
                 disabled={isFightingStylePreSelected(style) && fightingStyles.includes(style)}
               />
               &nbsp;{style}
             </label>
           ))}
         </div>
         {errors.fightingStyles && <span className="error-message">{errors.fightingStyles}</span>}
       </div>
     </div>
   );
}

export default WizardStepLanguages;