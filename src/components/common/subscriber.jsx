
import React, { useEffect, useRef } from 'react';

/**
 * WARNING: SSE re-render loop risk
 *
 * When this component connects to the SSE stream it sends its own clientId so
 * the server can tag every event with `selfId`.  On receive we skip any event
 * whose `selfId` matches ours, meaning we will never process our own echoed
 * changes.  This prevents re-render loops caused by request -> publish() ->
 * echo back to sender -> side effects firing again.
 *
 * The self-echo guard is a first line of defense; useSSEEqualityGuard provides
 * an additional safety net for mutations that cannot be attributed (e.g. initial
 * connect snapshot which has no selfId).
 */
import clientId from '../../utils/sseClientId.js';

const Subscriber = ({ handleEvent, campaignName }) => {
    const handleEventRef = useRef(handleEvent);
    handleEventRef.current = handleEvent;

    useEffect(() => {
        const host = window.location.hostname;
        const urlParams = new URLSearchParams({
            clientId,
         });
        if (campaignName) {
            urlParams.set('campaign', campaignName);
         }
        const url = `http://${host}/subscribe?${urlParams.toString()}`;
        const eventSource = new EventSource(url);
        eventSource.onmessage = (e) => {
            const event = JSON.parse(e.data);
            if (event.selfId === clientId) return;
            handleEventRef.current(event);
         };
        return () => {
            eventSource.close();
         };
     }, [campaignName]);
    return (
         <React.Fragment></React.Fragment>
     );
};

export default Subscriber;
