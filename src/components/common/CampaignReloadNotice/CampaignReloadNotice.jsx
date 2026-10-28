// @maintained-by-ai
// Whole-campaign-replace banner (bug-admin-reload-broadcast-no-consumer).
// reloadCampaign() on the server publishes a `reload-<campaign>` SSE frame
// with null data after an Admin rollback, upload, or full-reset. The
// initiating tab self-reloads (sessionStorage postRestoreNotice lane); this
// component is the consumer for every OTHER connected client, which
// previously kept serving pre-replace data silently forever. It rides the
// shared SSE client directly (useLog pattern) so App's dispatch table and
// statement budget stay untouched. Renders nothing until a reload frame for
// the active campaign arrives; UI-only state — the campaign is server truth.
import { useEffect, useState } from 'react';
import { subscribeToSSE } from '../../../services/ui/sseClient.js';
import './CampaignReloadNotice.css';

// The tab that triggered a rollback stores postRestoreNotice in sessionStorage
// immediately before its own window.location.reload(); the SSE fan-out can
// echo back to it in that window — it never needs the banner.
function isInitiatingRestoreClient() {
    try {
        return sessionStorage.getItem('postRestoreNotice') != null;
    } catch (err) {
        console.error('Failed to read post-restore notice:', err);
        return false;
    }
}

const CampaignReloadNotice = ({ campaignName }) => {
    const [notice, setNotice] = useState(false);

    useEffect(() => {
        if (!campaignName) return undefined;
        setNotice(false);
        return subscribeToSSE(campaignName, (event) => {
            if (event.key !== `reload-${campaignName}`) return;
            if (!isInitiatingRestoreClient()) setNotice(true);
        });
    }, [campaignName]);

    if (!notice) return null;

    return (
        <div className="ct-container campaign-reload-notice" role="alert">
            <div className="campaign-reload-notice-inner">
                <i className="fa-solid fa-rotate" aria-hidden="true" />
                <span className="campaign-reload-notice-text">
                    This campaign was replaced on the server (GM restore or upload).
                    Your view is stale — reload to see the current data.
                </span>
                <button className="ct-btn ct-btn-primary campaign-reload-notice-btn" onClick={() => window.location.reload()}>
                    Reload
                </button>
                <button className="ct-btn campaign-reload-notice-btn" onClick={() => setNotice(false)}>
                    Dismiss
                </button>
            </div>
        </div>
    );
};

export default CampaignReloadNotice;
