/* eslint-disable react/prop-types */
import { useEffect, useCallback } from 'react';
import { sanitizeHtml } from '../../services/sanitize.js';
import './popup.css'

function Popup({ html, onClickOrKeyDown }) {
    const handleOnClickOrKeyDown = useCallback(() => {
        document.removeEventListener("keydown", handleOnClickOrKeyDown);
        onClickOrKeyDown();
    }, [onClickOrKeyDown]);

    useEffect(() => {
        document.addEventListener("keydown", handleOnClickOrKeyDown);
        return () => {
            document.removeEventListener("keydown", handleOnClickOrKeyDown);
        };
    }, [handleOnClickOrKeyDown]);

    return (
        <div className="popup-overlay" data-testid="popup-overlay" role="presentation" onClick={handleOnClickOrKeyDown}>
            <div className="popup-modal" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}></div>
        </div>
    );
}

export default Popup