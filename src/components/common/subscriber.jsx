
import React, { useEffect, useRef } from 'react';

/**
  * WARNING: SSE re-render loop risk
  *
  * Loop prevention works in two layers:
  * 1. setRuntimeObject is called with skipSync=true from the SSE handler,
  *    so it updates the local store without re-POSTing to the server.
  * 2. equality guards in setRuntimeValue/setRuntimeObject prevent unnecessary
  *    writes when the value hasn't actually changed.
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
            // console.log(`[SSE] event from server: key=${event.key}`);
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
