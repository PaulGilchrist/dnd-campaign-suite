import { useAsyncData } from '../useAsyncData.js';

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
  const fetchMonsters = async () => {
    if (cache['monsters']) return cache['monsters'];

    const path = '/data/monsters.json';

    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(
        `Failed to load monsters (${response.status} ${response.statusText})`
      );
    }

    const data = await response.json();
    cache['monsters'] = data;
    return data;
  };

  const { data: monsters, loading, error } = useAsyncData(fetchMonsters, [], []);

  return { monsters, loading, error };
}
