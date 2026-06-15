/**
 * Deduplicate and sort an array of values.
 *
 * @param {Array} arr - Array of values to deduplicate and sort
 * @param {string} [sortKey] - Optional key to sort by (for objects)
 * @returns {Array} Sorted, deduplicated array
 */
export function deduplicateAndSort(arr, sortKey) {
    if (!arr || !Array.isArray(arr)) return [];
    const unique = [...new Set(arr)];
    if (!sortKey) return unique.sort();
    return unique.sort((a, b) => {
        const valA = a?.[sortKey] || '';
        const valB = b?.[sortKey] || '';
        return String(valA).localeCompare(String(valB));
    });
}
