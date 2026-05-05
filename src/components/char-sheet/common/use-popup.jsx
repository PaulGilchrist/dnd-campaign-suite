/* eslint-disable react/prop-types */
import React from 'react'
import Popup from '../../common/popup'

/**
 * Hook that manages popup state and provides HTML string.
 * 
 * @param {Function} buildHtml - Function that receives an entity and returns HTML string (or null to not show)
 * @returns {Object} { showPopup, popupData, setPopupHtml }
 */
function usePopup(buildHtml) {
    const [popupHtml, setPopupHtml] = React.useState(null);
    
    const showPopup = (entity) => {
        const html = buildHtml(entity);
        if (html) {
            setPopupHtml(html);
          }
      };
      
    const popupData = popupHtml;
      
    return { showPopup, popupData, setPopupHtml };
}

export default usePopup