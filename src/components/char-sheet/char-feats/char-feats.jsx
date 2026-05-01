/* eslint-disable react/prop-types */
import React from 'react'
import usePopup from '../common/use-popup'
import './char-feats.css'

function CharFeats({ playerStats, showPopup }) {
    const { PopupElement, setPopupHtml } = usePopup(() => null);
    
    const handleFeatClick = (featName) => {
        // Load feats from appropriate JSON file based on rules version
        const rulesVersion = playerStats.rules || '5e';
        const featsFile = rulesVersion === '2024' ? '2024/feats.json' : 'feats.json';
        // Use the deployment path from Vite config base
        const featsUrl = `/data/${featsFile}`;
        
        
        fetch(featsUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
             })
             .then(featsData => {
                 // For 2024, feat names are uppercase (e.g., "ACTOR", "ATHLETE")
                 // For 5e, feat names use lowercase with hyphens (e.g., "actor", "athlete")
                 // Character feat names are typically title case with spaces (e.g., "Actor", "Athlete")
                const normalizedInput = featName.toUpperCase().replace(/\s+/g, '_');
                const feat = featsData.find(f => {
                    const normalizedName = (f.name || '').toUpperCase().replace(/\s+/g, '_');
                    const normalizedIndex = (f.index || '').toUpperCase().replace(/\s+/g, '_');
                    return normalizedName === normalizedInput || normalizedIndex === normalizedInput;
                });
                if (feat) {
                    showPopup(feat);
                } else {
                    console.warn(`[CharFeats] Feat not found: ${featName} (normalized: ${normalizedInput})`);
                    setPopupHtml(`<b>${featName}</b><br/><br/>Feat details not found in database.`);
                 }
             })
             .catch(error => {
                console.error(`[CharFeats] Error loading feats:`, error);
                setPopupHtml(`<b>${featName}</b><br/><br/>Error loading feat details: ${error.message}. Check browser console for more details.`);
             });
     };
    
    if (!playerStats.feats || playerStats.feats.length === 0) {
        return null;
    }
    
    return (
         <div className="char-feats-section">
             {PopupElement}
             <div className="feats-container">
                 <b>Feats: </b>
                 {playerStats.feats.map((featName, index) => (
                     <span key={index} className="feat-name clickable" onClick={() => handleFeatClick(featName)}>
                         {featName}
                         {index < playerStats.feats.length - 1 ? ', ' : ''}
                     </span>
                 ))}
             </div>
         </div>
     );
}

export default CharFeats