 
import React, { useEffect } from 'react';

const Subscriber = ({handleEvent}) => {
    useEffect(() => {
        const fullUrl = `http://${window.location.hostname}/subscribe`;
        const eventSource = new EventSource(fullUrl);
        eventSource.onmessage = (e) => {
            const event = JSON.parse(e.data);
            handleEvent(event);
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