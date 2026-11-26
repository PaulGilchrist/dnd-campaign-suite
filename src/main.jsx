import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
// Token cosmetics palette + shared ring language (Item 5) — global because
// one swatch definition must drive the indoor board, the token menu, and the
// hex marching-order avatars identically (ids in config/tokenCosmetics.js).
import './config/tokenCosmetics.css';
import '@fortawesome/fontawesome-free/css/all.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
);
