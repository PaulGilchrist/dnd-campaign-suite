/* eslint-disable react/prop-types */
import React from 'react'
import { loadFeatData } from '../../../services/data-loader'
import usePopup from '../common/use-popup'
import Popup from '../../common/popup'
import './char-feats.css'

function CharFeats({ playerStats, showPopup }) {
    const { popupHtml, setPopupHtml } = usePopup(() => null);
    
    const handleFeatClick = async (featName) => {
        try {
            const rulesVersion = playerStats.rules || '5e';
            const featsData = await loadFeatData(rulesVersion);

            if (!featsData || featsData.length === 0) {
                console.warn(`[CharFeats] No feat data loaded for version: ${rulesVersion}`);
                setPopupHtml(`<b>${featName}</b><br/><br/>Feat details not found in database.`);
                return;
            }

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
        } catch (error) {
            console.error(`[CharFeats] Error loading feats:`, error);
            setPopupHtml(`<b>${featName}</b><br/><br/>Error loading feat details: ${error.message}. Check browser console for more details.`);
        }
     };
    
    if (!playerStats.feats || playerStats.feats.length === 0) {
        return null;
    }
    
    return (
         <div className="char-feats-section">
              {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml(null)} />}
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
