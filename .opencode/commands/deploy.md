---
name: deploy
description: Build the production bundle and deploy it to GitHub Pages using the gh-pages package.
usage: |
  Use this command when you want to publish the latest build of the site
  to https://PaulGilchrist.github.io/dnd-tools/.

  This command runs:
  1. npm run build
  2. npm run deploy  (gh-pages → pushes dist/ to gh-pages branch)

instructions:
  - Always run a production build before deploying.
  - Ensure the Vite base path is correctly set to /dnd-tools/ (as configured in vite.config.js).
  - Confirm that image assets remain unhashed in the build output, as required for fast GitHub Pages deployments.
  - Never modify deployment scripts unless explicitly requested.
  - Do not deploy if tests are failing or the build contains errors.
  - After deployment, verify the site loads correctly at the GitHub Pages URL.

command: |
  npm run build && npm run deploy
---
