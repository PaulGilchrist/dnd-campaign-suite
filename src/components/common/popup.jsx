
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import './popup.css'

function Popup({ html, children, onClickOrKeyDown, showCloseButton = true }) {
    return (
        <div className="popup-overlay" data-testid="popup-overlay" role="presentation">
             <div className="popup-modal">
                  {html ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}></div> : children}
                  {showCloseButton && onClickOrKeyDown && (
                    <div className="popup-close-row">
                      <button type="button" className="popup-close-btn" onClick={onClickOrKeyDown}>Done</button>
                    </div>
                  )}
             </div>
        </div>
    );
}

export default Popup
