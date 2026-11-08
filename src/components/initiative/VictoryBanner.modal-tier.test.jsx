// @maintained-by-ai
/**
 * Z-order tier contract for the victory banner (bug-victory-banner-above-
 * confirm-dialogs, 2026-11-08).
 *
 * The banner used to mount at z-index 1300 — ABOVE the shared modal tier
 * (`modal-shell-overlay` at 1000). While an undismissed banner was up, its
 * centered `.victory-card` sat over any later-opened confirmation dialog and
 * silently intercepted the dialog's own confirm button (Playwright hit-test:
 * `victory-card … intercepts pointer events` on "Yes, Clear Board"; the first
 * click only dismissed the banner). 29e67520e made the SCRIM click-through,
 * but the card lane above modals stayed open.
 *
 * Locked here: the banner lives on its own ambient tier — above the page
 * chrome (highest fixed z 100: sidebar / party inventory) but BELOW every
 * dialog tier, so nothing the user must click can ever end up under the
 * celebration card. jsdom does not apply external stylesheets, so the CSS is
 * parsed directly (house pattern from VictoryBanner.no-capture.test).
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Read a stylesheet relative to src/ and strip /* ... *\/ comments. */
const readCss = (relPath) =>
  readFileSync(join(SRC_DIR, '..', '..', relPath), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

function parseRule(css, selector) {
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'i');
  const match = css.match(re);
  if (!match) return null;
  const props = {};
  for (const decl of match[1].split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    props[decl.slice(0, colon).trim().toLowerCase()] = decl.slice(colon + 1).trim().toLowerCase();
  }
  return props;
}

const initiativeCss = readCss('components/initiative/Initiative.css');
const appCss = readCss('App.css');
const popupCss = readCss('components/common/popup.css');
const sidebarCss = readCss('components/sidebar/Sidebar.css');

const zOf = (props, where) => {
  expect(props, `${where} rule not found`).not.toBeNull();
  const z = Number(props['z-index']);
  expect(Number.isFinite(z), `${where} has no numeric z-index`).toBe(true);
  return z;
};

describe('victory banner sits below every dialog tier', () => {
  const bannerZ = zOf(parseRule(initiativeCss, '.initiative .victory-banner'), 'victory-banner');

  it('banner outranks the shared confirmation-modal tier (modal-shell-overlay)', () => {
    const modalZ = zOf(parseRule(appCss, '.modal-shell-overlay'), 'modal-shell-overlay');
    expect(bannerZ).toBeLessThan(modalZ);
  });

  it('banner outranks the lowest dialog tier (dice-result popup overlay)', () => {
    const popupZ = zOf(parseRule(popupCss, '.popup-overlay'), 'popup-overlay');
    expect(bannerZ).toBeLessThan(popupZ);
  });

  it('banner still covers the page chrome (sidebar is the highest fixed chrome)', () => {
    const sidebarZ = zOf(parseRule(sidebarCss, '.sidebar'), 'sidebar');
    expect(bannerZ).toBeGreaterThan(sidebarZ);
  });

  it('banner is the only Initiative overlay above page content but below 200', () => {
    // Guards the documented tier slot: ambient celebration lands between page
    // chrome (<=100) and the first dialog tier (200).
    expect(bannerZ).toBeGreaterThan(100);
    expect(bannerZ).toBeLessThan(200);
  });
});
