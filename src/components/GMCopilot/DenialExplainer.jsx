import { useEffect, useState } from 'react';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import { isLocalhostBrowser } from '../../services/ui/isLocalhostBrowser.js';
import GMCopilot from './GMCopilot.jsx';

/**
 * First-denial explainer (deferred plan A). Watches the EXISTING campaign
 * log lane over the one shared SSE connection for `enforcement_denied`
 * rows, and surfaces a one-time GMCopilot card for the latest denial `rule`
 * class (stamped at the producers — never parsed from prose). GM-only: the
 * card explains the rule and its Admin off-switch, which is referee
 * knowledge; players keep the honest denial popup + log row only.
 *
 * Zero new state lanes: the "recent denial" is ephemeral per-client UI
 * state (legal local flag); settling rides the existing `gmCopilot` key via
 * GMCopilot's own dismiss lane. No history scan on mount — the explainer is
 * about the LIVE first-denial moment. No timers: the card stays until
 * dismissed (×) or a newer denial class takes its slot.
 */
const RULE_TO_TIP = {
    turnLock: 'denial-turnlock',
    actionEconomy: 'denial-economy',
    movementBudget: 'denial-movement',
    lineOfSight: 'denial-los',
};

export default function DenialExplainer({ campaignName, tvMode = false }) {
    const [tipId, setTipId] = useState(null);

    useEffect(() => {
        if (!campaignName || tvMode || !isLocalhostBrowser()) return undefined;
        return subscribeToSSE(campaignName, (event) => {
            if (!event.key.startsWith('log-')) return;
            const entry = event.data;
            if (!entry || entry.type !== 'enforcement_denied') return;
            const tip = RULE_TO_TIP[entry.rule];
            if (tip) setTipId(tip);
        });
    }, [campaignName, tvMode]);

    if (!tipId) return null;
    return <GMCopilot campaignName={campaignName} tipId={tipId} />;
}
