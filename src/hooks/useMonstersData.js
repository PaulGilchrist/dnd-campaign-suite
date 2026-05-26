import { useState, useEffect } from 'react';

/** Module-level cache */
const cache = {};

/**
 * Custom hook to load monster data from local JSON files.
 * Fetches from /data/monsters.json.
 * Results are cached in-memory so re-fetching returns instantly.
 *
 * @returns {{ monsters: object[], loading: boolean, error: string|null }}
 */
export function useMonstersData() {
    const [monsters, setMonsters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchMonsters() {
            // Return cached data immediately — skip loading state
            if (cache['monsters']) {
                if (!cancelled) {
                    setMonsters(cache['monsters']);
                    setLoading(false);
                    setError(null);
                }
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const path = '/data/monsters.json';

                const response = await fetch(path);

                if (!response.ok) {
                    throw new Error(
                        `Failed to load monsters (${response.status} ${response.statusText})`
                    );
                }

                const data = await response.json();

                if (!cancelled) {
                    cache['monsters'] = data;
                    setMonsters(data);
                    setLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message);
                    setMonsters([]);
                    setLoading(false);
                }
            }
        }

        fetchMonsters();

        return () => {
            cancelled = true;
        };
    }, []);

    return { monsters, loading, error };
}
