import { useState, useEffect, useCallback } from 'react';
import * as logService from '../services/logService.js';

const MAX_LOG_ENTRIES = 200;

export default function useLog(campaignName) {
   const [logEntries, setLogEntries] = useState([]);
    const [initialized, setInitialized] = useState(false);

      // Load initial log on mount/campaign change
    useEffect(() => {
        if (!campaignName) return;
        (async () => {
          try {
              const entries = await logService.getLog(campaignName);
             setLogEntries(entries.slice(-MAX_LOG_ENTRIES));
            } catch (err) {
                console.error('Failed to load log:', err);
            } finally {
             setInitialized(true);
            }
         })();
        }, [campaignName]);

      // Subscribe to SSE events for new log entries
    useEffect(() => {
         if (!campaignName) return;
        const host = window.location.hostname;
        const urlParams = new URLSearchParams({
            campaign: campaignName,
          });
        const url = `http://${host}/subscribe?${urlParams.toString()}`;
         const eventSource = new EventSource(url);

      eventSource.onmessage = (e) => {
          try {
                const event = JSON.parse(e.data);
               if (!event.key.startsWith('log-')) return;
             setLogEntries(prev => {
                  const updated = [...prev, event.data];
                 return updated.slice(-MAX_LOG_ENTRIES);
                });
            } catch (err) {
             // Ignore parse errors for non-log events
            }
          };

        return () => eventSource.close();
        }, [campaignName]);

    const addEntry = useCallback(async (entry) => {
        if (!campaignName) return;
       try {
          await logService.addEntry(campaignName, entry);
         // Don't need to update local state - SSE will push it
           } catch (err) {
            console.error('Failed to add log entry:', err);
         }
      }, [campaignName]);

    return { logEntries, initialized, addEntry };
}
