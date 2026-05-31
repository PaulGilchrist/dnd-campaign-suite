import { useState, useEffect, useRef, useCallback } from 'react';
import { loadMonsters } from '../../services/dataLoader.js';
import './MonsterNameAutocomplete.css';

function MonsterNameAutocomplete({ value, onChange = () => {}, onCommit, position, initialFocus = true, npcs }) {
    const [monsters, setMonsters] = useState([]);
    const [query, setQuery] = useState(value || '');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        loadMonsters().then(setMonsters).catch(() => {});
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
        if (initialFocus && inputRef.current) inputRef.current.focus();
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
        debounceRef.current = setTimeout(() => {
            setShowSuggestions(suggestions().length > 0);
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
                setShowSuggestions(false);
                 }
            };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
         }, []);

    const handleInputChange = (e) => {
        setQuery(e.target.value);
        onChange(e.target.value);
         };

    const selectSuggestion = (name) => {
        setQuery(name);
        setShowSuggestions(false);
        onChange(name);
        if (onCommit) onCommit(name);
        if (inputRef.current) inputRef.current.focus();
         };

    const handleBlur = () => {
        setShowSuggestions(false);
        if (onCommit) onCommit(query);
         };

    const handleKeyDown = (e) => {
        const list = suggestions();
        if (!showSuggestions || !list.length) {
            if (e.key === 'Enter') {
                e.preventDefault();
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
                 autoFocus={initialFocus}
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
