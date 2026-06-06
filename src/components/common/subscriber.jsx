
import React, { useEffect, useRef } from 'react';

/**
  * WARNING: SSE re-render loop risk
  *
  * Self-echoes are no longer filtered by selfId.  Loop prevention relies entirely
  * on equality guards in downstream handlers: setRuntimeValue, setRuntimeObject,
  * useSSEEqualityGuard, and idempotent setState callbacks that return prev unchanged.
  */

const Subscriber = ({ handleEvent, campaignName }) => {
    const handleEventRef = useRef(handleEvent);
    handleEventRef.current = handleEvent;

    useEffect(() => {
        const host = window.location.hostname;
        const urlParams = new URLSearchParams();
        if (campaignName) {
            urlParams.set('campaign', campaignName);
         }
        const url = `http://${host}/subscribe?${urlParams.toString()}`;
        const eventSource = new EventSource(url);
    eventSource.onmessage = (e) => {
            const event = JSON.parse(e.data);
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
