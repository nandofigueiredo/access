const path = require('path');

const root = __dirname;

module.exports = {
  apps: [
    {
      name: 'portal-ti-frontend',
      cwd: root,
      script: path.join(root, 'scripts', 'run-frontend.cjs'),
      interpreter: 'node',
      windowsHide: true,
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: 'portal-ti-api',
      cwd: root,
      script: path.join(root, 'scripts', 'run-api.cjs'),
      interpreter: 'node',
      windowsHide: true,
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
