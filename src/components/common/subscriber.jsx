 
import React, { useEffect, useRef } from 'react';

const Subscriber = ({handleEvent}) => {
    const handleEventRef = useRef(handleEvent);
    handleEventRef.current = handleEvent;

    useEffect(() => {
        const fullUrl = `http://${window.location.hostname}/subscribe`;
        const eventSource = new EventSource(fullUrl);
        eventSource.onmessage = (e) => {
            const event = JSON.parse(e.data);
            handleEventRef.current(event);
        };
        eventSource.onerror = (error) => {
            console.error('Event subscription error:', error);
        };
        return () => {
            eventSource.close();
        };
    }, []);
    return (
        <React.Fragment></React.Fragment>
    );
};

export default Subscriber;