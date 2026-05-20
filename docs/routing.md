# Routing / Navigation Pattern

## 1. Overview

This project uses a single `activeView` string variable to track which sidebar view is displayed. There is no react-router, wouter, or any other routing library.

Setting `activeView` to a view name automatically hides any other view. No clearing logic is needed — mutual exclusivity is implicit.

**Key characteristics:**

- The URL never changes — no deep linking, no browser history, no `pushState`.
- The sidebar is always visible (except during campaign selection).
- All navigation is handled through state setters in `App.jsx` and its child components.
- **`src/routes/config.js` is the single source of truth** for view definitions and sidebar buttons.

## 2. State Variables

| State Variable | Type | Controls | Component | Notes |
|---|---|---|---|---|
| `activeView` | `string \| null` — `'charSheet' \| 'mapsManager' \| 'encounter' \| 'notes' \| 'npcs' \| 'initiative'` | Which sidebar view is shown | — | Single source of truth for sidebar navigation. Setting it to a view name hides all others. |
| `mapsView` | `{ type: 'none' \| 'manager' \| 'map', mapName?: string }` | Internal maps manager state | `<MapsManager>` | Only relevant when `activeView === 'mapsManager'`. |
| `activeCharacter` | `object \| null` — `Character` | CharSheet visibility | `<CharSheet>` | Set when a character is clicked. |
| `showCampaignSelection` | `boolean` | Campaign selection overlay | `<CampaignSelection>` | Full-screen overlay; blocks everything when `true`. |
| `showCharacterWizard` | `boolean` | New character creation overlay | `<CharacterCreationWizard>` (add mode) | Overlay; does not affect `activeView`. |
| `showEditCharacterWizard` | `boolean` | Character editing overlay | `<CharacterCreationWizard>` (edit mode) | Overlay; needs `activeCharacter` to function. |

## 3. How Navigation Works

- **Switching views** — All sidebar buttons call `setActiveView(viewName)` to switch to the selected view. Setting `activeView` to a new value automatically hides whatever was previously shown.
- **Toggling off** — Clicking the same sidebar button again sets `activeView` to `null`, closing the view.
- **Characters** — Clicking a character sets `activeView('charSheet')` and `activeCharacter` to that character's data.
- **Wizards** — Wizards are overlays. They do not affect `activeView` and are not affected by it.
- **Maps** — Maps use `mapsView` internally to track whether the manager or a specific map is displayed. `activeView === 'mapsManager'` must be `true` for any maps to show.

## 4. View Coexistence

All sidebar views are mutually exclusive. Only one can be active at a time. Wizards can overlay anything.

## 5. How to Add a New View

1. **Add entry to `VIEWS`** in `src/routes/config.js` with `stateVar: 'activeView'`, `type: 'string'`.
2. **Add view name to `SIDEBAR_VIEWS`** array in config.
3. **Add sidebar button to `SIDEBAR_BUTTONS`** in config.
4. **Add toggle handler:**
   ```js
   setActiveView(prev => prev === 'viewName' ? null : 'viewName')
   ```
5. **Add conditional render:**
   ```jsx
   {activeView === 'viewName' && <Component />}
   ```

## 6. Important Notes

- **Do NOT add react-router or any routing library.** It will conflict with the state-based pattern and is unnecessary for this application.
- **Do NOT create `Route` components** or use `useNavigate`, `useParams`, `useLocation`, or any other React Router hooks.
- **`src/routes/config.js` is the single source of truth.** View definitions and sidebar buttons are all defined there.
- **`mapsView` is an object with a `type` field**, not a boolean. Its shape is `{ type: 'none' }`, `{ type: 'manager' }`, or `{ type: 'map', mapName: string }`.
- **Wizards are overlays that do not affect `activeView`.** They neither clear other views nor get cleared by them.
- **Campaign changes reset `mapsView` to `{ type: 'none' }` and `activeView` to `null`.**
- **GM vs Player behavior differs for Maps.** The `isLocalhost` flag controls whether the Maps button opens a manager (GM) or directly loads the active map (player).
