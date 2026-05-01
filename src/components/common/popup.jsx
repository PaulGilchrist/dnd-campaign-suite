/* eslint-disable react/prop-types */
import { sanitizeHtml } from '../../services/sanitize.js';
import './popup.css'

function Popup({ html, onClickOrKeyDown }) {
    const handleOnClickOrKeyDown = () => {
        document.removeEventListener("keydown", handleOnClickOrKeyDown);
        onClickOrKeyDown();
    };
    document.addEventListener("keydown", handleOnClickOrKeyDown); // Close 
        return (
         <div className="popup-overlay" role="presentation" onClick={handleOnClickOrKeyDown}>
            <div className="popup-modal" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}></div>
        </div>
    )
}

export default Popup
