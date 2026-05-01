/* eslint-disable react/prop-types */
import React from 'react'
import Popup from '../../common/popup'

/**
 * Hook that manages popup state and provides a render method.
 * 
 * @param {Function} buildHtml - Function that receives an entity and returns HTML string (or null to not show)
 * @returns {Object} { showPopup, PopupElement, setPopupHtml }
 */
function usePopup(buildHtml) {
    const [popupHtml, setPopupHtml] = React.useState(null);
    
    const showPopup = (entity) => {
        const html = buildHtml(entity);
        if (html) {
            setPopupHtml(html);
          }
      };
      
    const PopupElement = popupHtml ? (
          <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml(null)} />
      ) : null;
      
    return { showPopup, PopupElement, setPopupHtml };
}

export default usePopup