 
import React from 'react'

/**
 * Hook that manages popup state and provides HTML string.
 *
 * @param {Function} buildHtml - Function that receives an entity and returns HTML string (or null to not show)
 * @returns {Object} { showPopup, popupHtml, setPopupHtml }
 */
function usePopup(buildHtml) {
    const [popupHtml, setPopupHtml] = React.useState(null);

    const showPopup = (entity) => {
        const html = buildHtml(entity);
        if (html) {
            setPopupHtml(html);
        }
    };

    return { showPopup, popupHtml, setPopupHtml };
}

export default usePopup
