import { useEffect, useMemo, useState } from 'react';
import guideMarkdown from '../../../docs/users-guide.md?raw';
import MarkdownPreview from '../common/MarkdownPreview.jsx';
import { VIEW_HELP } from '../../routes/viewHelp.js';
import './HelpDrawer.css';

/**
 * In-app Help drawer (learnability plan Phase 3). A right-side panel opened
 * from the sidebar "?" button, holding:
 *
 * - "About this screen" — a plain-English summary of the view you are on
 *   (routes/viewHelp.js), and
 * - the FULL users guide — imported raw from docs/users-guide.md at build
 *   time, so the app and the docs can never drift (one source of truth),
 *   split into sections and searchable client-side.
 *
 * Pure reading surface: no writes, no game state — open/closed is a per-client
 * UI flag like every showModal.
 */

// Split the guide on `## N. Title` section headings. Everything before the
// first heading (H1 + intro) becomes the "Welcome" entry; the in-file Table
// of Contents is dropped (the drawer's own list IS the contents).
function parseGuide(md) {
  const sections = [];
  let current = { title: 'Welcome', lines: [] };
  for (const line of md.split('\n')) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      sections.push(current);
      // The heading line is NOT re-pushed into the body: the drawer's own
      // <summary> is the section title, and re-rendering `## …` inside the
      // markdown would duplicate it as a stray <h2>.
      current = { title: heading[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections
    .filter((s) => s.lines.join('\n').trim())
    .filter((s) => !/^table of contents$/i.test(s.title))
    .map((s) => ({
      title: s.title,
      text: s.lines.join('\n'),
    }));
}

const GUIDE_SECTIONS = parseGuide(guideMarkdown);

function HelpDrawer({ open, onClose, activeView }) {
  const [query, setQuery] = useState('');

  // Escape closes, matching the app-wide modal idiom.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset the search on every open so the drawer never re-opens filtered.
  useEffect(() => { if (open) setQuery(''); }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return GUIDE_SECTIONS
      .filter((s) => s.title.toLowerCase().includes(q) || s.text.toLowerCase().includes(q))
      .map((s) => s.title);
  }, [query]);

  if (!open) return null;
  const about = VIEW_HELP[activeView];

  return (
    <div className="help-drawer-backdrop" onClick={onClose}>
      <aside
        className="help-drawer"
        role="dialog"
        aria-label="Help"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-drawer-head">
          <h3><i className="fa-solid fa-circle-question" aria-hidden="true"></i> Help</h3>
          <button className="help-drawer-close" onClick={onClose} title="Close help (Esc)">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        {about && (
          <div className="help-drawer-about" role="note" aria-label="About this screen">
            <h4><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> About this screen</h4>
            <p>{about}</p>
          </div>
        )}

        <input
          className="help-drawer-search"
          type="search"
          placeholder="Search the guide…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the users guide"
        />

        <div className="help-drawer-sections">
          {GUIDE_SECTIONS.map((section) => {
            const filtering = matches !== null;
            const shown = !filtering || matches.includes(section.title);
            if (!shown) return null;
            return (
              <details key={section.title} open={filtering || undefined}>
                <summary>{section.title}</summary>
                <MarkdownPreview text={section.text} className="help-drawer-md" />
              </details>
            );
          })}
          {matches !== null && matches.length === 0 && (
            <p className="help-drawer-empty">Nothing in the guide matches “{query.trim()}”.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

export default HelpDrawer;
