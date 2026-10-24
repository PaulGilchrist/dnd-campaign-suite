import { useState, useEffect, useRef, useCallback } from 'react';
import { loadMonsters } from '../../services/ui/dataLoader.js';
import './MonsterNameAutocomplete.css';

// Ghost-list guard (bug-eb-autocomplete-ghost-blocks-initiative-clicks):
// Initiative cards are keyed `${creature.name}-${runtimeStateTick}`, so every
// rename keystroke POST + SSE echo REMOUNTS this component — any "user is
// typing" signal must outlive the instance or the +NPC rename lane
// ("rename it to a monster name…") loses its dropdown mid-word. The stamp
// below records the exact text the field last typed upward; a list may only
// (re)open while that intent is fresh and undismissed. Passive mounts — EB
// Join auto-navigating to Initiative with pre-filled card names, turn re-keys —
// never match, so no ghost dropdown can drape over card inputs and swallow
// clicks. Benign UI intent only: no game state, cleared on blur/outside/pick.
let lastTypedQuery = null;
let lastTypedAt = 0;
const TYPING_INTENT_MS = 2000;

function markTyped(text) {
    lastTypedQuery = text;
    lastTypedAt = Date.now();
}

function clearTyped() {
    lastTypedQuery = null;
    lastTypedAt = 0;
}

function isTypingIntent(text) {
    return !!text && lastTypedQuery === text && Date.now() - lastTypedAt < TYPING_INTENT_MS;
}

function MonsterNameAutocomplete({ value, onChange = () => {}, onCommit, position, initialFocus = true, npcs }) {
    const [monsters, setMonsters] = useState([]);
    const [query, setQuery] = useState(value || '');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        loadMonsters().then(setMonsters).catch((e) => { console.error("[MonsterNameAutocomplete] Error:", e); });
         }, []);

    const allNames = useCallback(() => {
        const monsterNames = monsters.map(m => ({ name: m.name, index: m.index, source: 'monster' }));
        if (npcs?.length) {
            const npcNames = npcs
                .filter(n => n.name)
                .map(n => ({ name: n.name, index: n.name, source: 'npc' }));
            return [...npcNames, ...monsterNames];
        }
        return monsterNames;
    }, [monsters, npcs]);

    useEffect(() => {
        setQuery(value || '');
        setShowSuggestions(false);
          }, [value]);

    useEffect(() => {
        // preventScroll: refocusing on remount (cards re-key on runtimeStateTick each
        // turn) must not natively scroll the initiative carousel back to this card.
        if (initialFocus && inputRef.current) inputRef.current.focus({ preventScroll: true });
         // eslint-disable-next-line react-hooks/exhaustive-deps
         }, []);

    const suggestions = useCallback(() => {
        const names = allNames();
        if (!query.trim() || !names.length) return [];
        const q = query.trim().toLowerCase();
        const startedWith = names.filter(n => n.name.toLowerCase().startsWith(q)).slice(0, 8);
        const remaining = names.filter(n => {
            const name = n.name.toLowerCase();
            return name.includes(q) && !name.startsWith(q);
             }).slice(0, 8 - startedWith.length);
        return [...startedWith, ...remaining];
         }, [query, allNames]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        // Open ONLY on live typing intent (or its value echo across a card
        // re-key remount). Mount-time query seeds previously auto-opened this
        // list, so a card that merely APPEARED — e.g. Join Encounter
        // auto-navigating to Initiative — draped a ghost dropdown over
        // neighboring HP inputs and swallowed the GM's clicks.
        if (!isTypingIntent(query)) return;
        debounceRef.current = setTimeout(() => {
            setShowSuggestions(document.activeElement === inputRef.current && suggestions().length > 0);
            setHighlightedIndex(-1);
             }, 150);
        return () => clearTimeout(debounceRef.current);
         }, [query, suggestions]);

    useEffect(() => {
        if (highlightedIndex >= 0 && listRef.current) {
            const el = listRef.current.children[highlightedIndex];
            if (el) el.scrollIntoView({ block: 'nearest' });
             }
         }, [highlightedIndex]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.monster-autocomplete')) {
                clearTyped();
                setShowSuggestions(false);
                 }
            };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
         }, []);

    const handleInputChange = (e) => {
        markTyped(e.target.value);
        setQuery(e.target.value);
        onChange(e.target.value);
         };

    const selectSuggestion = (name) => {
        clearTyped();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setQuery(name);
        setShowSuggestions(false);
        onChange(name);
        if (onCommit) onCommit(name);
        if (inputRef.current) inputRef.current.focus({ preventScroll: true });
         };

    const handleBlur = () => {
        clearTyped();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setShowSuggestions(false);
        if (onCommit) onCommit(query);
         };

    const handleKeyDown = (e) => {
        const list = suggestions();
        if (!showSuggestions || !list.length) {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTyped();
                if (onCommit) onCommit(query);
                 }
            return;
             }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < list.length - 1 ? prev + 1 : 0));
             } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : list.length - 1));
    } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && list[highlightedIndex]) {
                selectSuggestion(list[highlightedIndex].name);
            } else if (onCommit) {
                clearTyped();
                if (debounceRef.current) clearTimeout(debounceRef.current);
                setShowSuggestions(false);
                onCommit(query);
            }
        }
         };

    const list = suggestions();

    return (
            <div className={`monster-autocomplete${position ? ' monster-autocomplete-fixed' : ''}`} style={position}>
                <input
                 ref={inputRef}
                 type="text"
                 value={query}
                 onChange={handleInputChange}
                 onKeyDown={handleKeyDown}
                 onBlur={handleBlur}
                 className="monster-autocomplete-input"
                 />
                {showSuggestions && list.length > 0 && (
                    <ul ref={listRef} className="monster-autocomplete-list">
                        {list.map((entry, i) => (
                            <li
                             key={`${entry.source}-${entry.index}`}
                             className={`monster-autocomplete-item${i === highlightedIndex ? ' highlighted' : ''}`}
                             onMouseDown={() => selectSuggestion(entry.name)}
                            >
                                {entry.name}
                                {entry.source === 'npc' && <span className="monster-autocomplete-badge">NPC</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
         );
}

export default MonsterNameAutocomplete;
