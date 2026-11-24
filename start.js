const { spawn } = require('child_process');
const path = require('path');

console.log('=======================================================');
console.log('       HACHI TECH POS & INVENTORY SYSTEM               ');
console.log('          Starting All Services...                     ');
console.log('=======================================================');

const backendDir = path.join(__dirname, 'backend');
const frontendDir = path.join(__dirname, 'frontend');

// 1. Start Backend Server
const backend = spawn('node', ['server.js'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true
});

// 2. Start Frontend Dev Server (Cross-platform npm / npm.cmd)
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true
});

console.log('\n[POS Launcher] Backend and Frontend are launching...');
console.log('[POS Launcher] Opening browser at http://localhost:3000 in 3 seconds...\n');

// Automatically open browser after 3 seconds
setTimeout(() => {
  const openCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(openCmd, ['http://localhost:3000'], { shell: true });
}, 3000);

// Graceful cleanup on exit
function shutdown() {
  console.log('\n[POS Launcher] Shutting down all POS services...');
  if (backend) backend.kill();
  if (frontend) frontend.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
