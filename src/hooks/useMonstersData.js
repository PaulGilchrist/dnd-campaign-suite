import { useState, useEffect } from 'react';

/** Module-level cache: keyed by rulesVersion ('5e' | '2024') */
const cache = {};

/**
 * Custom hook to load monster data from local JSON files.
 * Fetches from /data/monsters.json (5e) or /data/2024/monsters.json (2024).
 * Results are cached in-memory so re-fetching the same rulesVersion returns instantly.
 *
 * @param {string} rulesVersion - '5e' or '2024'. Defaults to '5e'.
 * @returns {{ monsters: object[], loading: boolean, error: string|null }}
 */
export function useMonstersData(rulesVersion = '5e') {
    const [monsters, setMonsters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchMonsters() {
            // Return cached data immediately — skip loading state
            if (cache[rulesVersion]) {
                if (!cancelled) {
                    setMonsters(cache[rulesVersion]);
                    setLoading(false);
                    setError(null);
                }
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const path = rulesVersion === '2024'
                    ? '/data/2024/monsters.json'
                    : '/data/monsters.json';

                const response = await fetch(path);

                if (!response.ok) {
                    throw new Error(
                        `Failed to load monsters (${response.status} ${response.statusText})`
                    );
                }

                const data = await response.json();

                if (!cancelled) {
                    cache[rulesVersion] = data;
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
    }, [rulesVersion]);

    return { monsters, loading, error };
}
