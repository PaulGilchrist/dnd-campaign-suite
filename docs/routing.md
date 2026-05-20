# Routing / Navigation Pattern

## 1. Overview

This project uses **state-based conditional rendering** for navigation. There is no react-router, wouter, or any other routing library.

Views are controlled by React `useState` variables in `App.jsx`. When a state variable changes, React re-renders and conditionally includes or excludes components in the DOM.

**Key characteristics:**

- The URL never changes — no deep linking, no browser history, no `pushState`.
- The sidebar is always visible (except during campaign selection).
- All navigation is handled through state setters in `App.jsx` and its child components.
- **`src/routes/config.js` is the single source of truth** for view definitions, clear rules, and sidebar buttons.

## 2. View State Variables

| State Variable | Type | Controls | Component | Notes |
|---|---|---|---|---|
| `showCampaignSelection` | `boolean` | Campaign selection gate | `<CampaignSelection>` | Full-screen overlay; blocks everything when `true` |
| `activeCharacter` | `object \| null` | Character sheet display | `<CharSheet>` | Cleared by maps, encounter, notes, NPCs, initiative. Needed by edit wizard. |
| `mapsView` | `{ type: 'none' \| 'manager' \| 'map', mapName?: string }` | Map views (GM manager or player map) | `<MapsManager>` or `<Map>` | Object with `type` field, not a boolean |
| `showInitiative` | `boolean` | Initiative panel | `<Initiative>` | Toggles on click, like encounter/notes/NPCs |
| `showEncounter` | `boolean` | Encounter builder panel | `<EncounterBuilder>` | Toggles on click |
| `showNotes` | `boolean` | Notes panel | `<Notes>` | Toggles on click |
| `showNPCs` | `boolean` | NPCs panel | `<NPCs>` | Set to `true` on click (no toggle); dismissed via `handleBackFromNPCs` |
| `showCharacterWizard` | `boolean` | New character creation overlay | `<CharacterCreationWizard>` (add mode) | Overlay; does not clear or get cleared by any view |
| `showEditCharacterWizard` | `boolean` | Character editing overlay | `<CharacterCreationWizard>` (edit mode) | Overlay; needs `activeCharacter` to function |

## 3. View Transition Rules

The transition logic is centralized in `App.jsx` via the `clearViews()` helper, which reads from `CLEAR_RULES` in `src/routes/config.js`:

```js
const clearViews = (viewName) => {
  (CLEAR_RULES[viewName] || []).forEach(view => {
    if (view === 'mapsManager' || view === 'map') setMapsView({ type: 'none' });
    if (view === 'initiative') setShowInitiative(false);
    if (view === 'encounter') setShowEncounter(false);
    if (view === 'notes') setShowNotes(false);
    if (view === 'npcs') setShowNPCs(false);
    if (view === 'charSheet') setActiveCharacter(null);
  });
};
```

### Clear Rules (from `src/routes/config.js`)

| Activated View | Clears |
|---|---|
| **Char Sheet** (`activeCharacter`) | mapsManager, map, initiative, encounter, notes, npcs |
| **Maps Manager** (`mapsView.type = 'manager'`) | charSheet, initiative, encounter, notes, npcs |
| **Map** (`mapsView.type = 'map'`) | charSheet, initiative, encounter, notes, npcs |
| **Initiative** (`showInitiative`) | charSheet, mapsManager, map, encounter, notes, npcs |
| **Encounter** (`showEncounter`) | charSheet, mapsManager, map, initiative, notes, npcs |
| **Notes** (`showNotes`) | charSheet, mapsManager, map, initiative, encounter, npcs |
| **NPCs** (`showNPCs`) | charSheet, mapsManager, map, initiative, encounter, notes |
| **Wizards** | *(none — overlays)* |

### View Coexistence

- **Sidebar components (Initiative, Encounter, Notes, NPCs)** — Mutually exclusive with each other. Clicking one clears the other three. All four are also cleared by Char Sheet and Maps views.
- **Maps and Initiative** — Maps clears initiative (along with encounter, notes, and NPCs). Initiative is a regular sidebar component, not a permanent fixture.
- **Wizards** — Overlay on top of everything. Neither wizard clears any view when opened, and no view clears them when opened. They are dismissed by completing or canceling.
- **Edit Wizard** — Requires `activeCharacter` to be set (it receives `characterData={activeCharacter}`).

### Campaign Selection

- **Blocks everything.** When `showCampaignSelection` is `true`, `App.jsx` returns early — nothing else renders.
- The only way to dismiss it is by selecting a campaign (which sets `showCampaignSelection` to `false`).
- If the loaded campaign has characters, the first one becomes active. If it has no characters, the character wizard opens.

### Campaign Change Resets

Two `useEffect` hooks reset state when `campaignName` changes:

```js
useEffect(() => { setMapsView({ type: 'none' }); }, [campaignName]);
useEffect(() => { setShowNotes(false); }, [campaignName]);
```

## 4. How to Add a New View

Follow this checklist, using `src/routes/config.js` as the source of truth:

1. **Add a view definition** in `src/routes/config.js` → `VIEWS` object:
   ```js
   NEW_VIEW: {
     name: 'newView',
     stateVar: 'showNewView',
     type: 'boolean',
     component: 'NewView',
     clears: ['charSheet', 'mapsManager', 'map', 'initiative', 'encounter', 'notes', 'npcs'],
     clearedBy: [],
     overlay: false,
     description: 'Description of the new view'
   }
   ```
   - Set `clears` to list which views this one closes.
   - Set `clearedBy` to list which views close this one.
   - Set `overlay: true` if it should not participate in clear rules (like wizards).

2. **Add a clear rule** in `src/routes/config.js` → `CLEAR_RULES`:
   ```js
   newView: ['charSheet', 'mapsManager', 'map', 'initiative', 'encounter', 'notes', 'npcs']
   ```
   - This is the list of views that get cleared when this view is activated.

3. **Add a state variable** in `App.jsx`:
   ```js
   const [showNewView, setShowNewView] = useState(false);
   ```

4. **Add a handler** in `App.jsx` that calls `clearViews('newView')` and toggles (or sets) the state:
   ```js
   const handleNewViewClick = () => {
     clearViews('newView');
     setShowNewView(prev => !prev);
   };
   ```
   - `clearViews()` reads from `CLEAR_RULES` in `config.js`, so clearing logic is centralized.

5. **Add a sidebar button** — pass the handler to `<Sidebar>` as a prop and add the button inside `Sidebar.jsx`.

6. **Add a sidebar button entry** in `src/routes/config.js` → `SIDEBAR_BUTTONS`:
   ```js
   { label: 'New View', icon: 'fa-icon-name', view: 'newView', action: 'handleNewViewClick' }
   ```

7. **Add conditional rendering** in `App.jsx` JSX:
   ```jsx
   {showNewView && (
     <NewViewComponent
       campaignName={campaignName}
       characters={characters}
       onBack={() => setShowNewView(false)}
     />
   )}
   ```

8. **If the view is an overlay** (like wizards), set `overlay: true` in the `VIEWS` definition and do NOT add it to `CLEAR_RULES`.

## 5. Important Notes

- **Do NOT add react-router or any routing library.** It will conflict with the state-based pattern and is unnecessary for this application.
- **Do NOT create `Route` components** or use `useNavigate`, `useParams`, `useLocation`, or any other React Router hooks.
- **`src/routes/config.js` is the single source of truth.** View definitions, clear rules, and sidebar buttons are all defined there. `App.jsx` reads from it via `clearViews()`.
- **`mapsView` is an object with a `type` field**, not a boolean. Its shape is `{ type: 'none' }`, `{ type: 'manager' }`, or `{ type: 'map', mapName: string }`.
- **Wizards are overlays that do not participate in clear rules.** They neither clear other views nor get cleared by them.
- **All sidebar components (Character, Initiative, Maps, Notes, Encounter, NPCs) work the same way.** They are toggled via the sidebar and are mutually exclusive with each other.
- **Campaign changes reset `mapsView` to `{ type: 'none' }` and `showNotes` to `false`.**
- **GM vs Player behavior differs for Maps.** The `isLocalhost` flag controls whether the Maps button opens a manager (GM) or directly loads the active map (player).
