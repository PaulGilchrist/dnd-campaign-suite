
import React, { useEffect, useRef } from 'react';
import { subscribeToSSE } from '../../services/ui/sseClient.js';

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
        return subscribeToSSE(campaignName, (event) => {
            handleEventRef.current(event);
        });
    }, [campaignName]);

    return (
         <React.Fragment></React.Fragment>
     );
};

export default Subscriber;
