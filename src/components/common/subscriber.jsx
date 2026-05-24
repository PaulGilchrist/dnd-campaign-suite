
import React, { useEffect, useRef } from 'react';

const Subscriber = ({ handleEvent, campaignName }) => {
    const handleEventRef = useRef(handleEvent);
    handleEventRef.current = handleEvent;

    useEffect(() => {
        const host = window.location.hostname;
        const url = campaignName
            ? `http://${host}/subscribe?campaign=${encodeURIComponent(campaignName)}`
            : `http://${host}/subscribe`;
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
