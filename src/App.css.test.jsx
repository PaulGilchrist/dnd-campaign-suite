const fs = require('fs');
const path = require('path');

describe('App.css .app rule', () => {
  it('should have max-width: 800px to prevent full-width layout', () => {
    const css = fs.readFileSync(path.join(__dirname, 'App.css'), 'utf-8');

    const appRuleMatch = css.match(/\.app\s*{([^}]+)}/);
    expect(appRuleMatch).toBeTruthy();

    const appRule = appRuleMatch[1];
    expect(appRule).toContain('max-width: 800px');
    expect(appRule).toContain('margin: 0 auto');
  });
});
