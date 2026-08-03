/**
 * Wrapper Windows-safe: sobe o Vite sem janela de CMD.
 */
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const child = spawn(
  process.execPath,
  [viteBin, '--port', '3000', '--host', '0.0.0.0'],
  {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'development' },
    windowsHide: true,
    stdio: 'inherit',
  }
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
