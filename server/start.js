const { spawn } = require('child_process');
const path = require('path');

function runCommand(command, args, name, cwd) {
  const process = spawn(command, args, {
    stdio: 'pipe',
    shell: true,
    cwd: cwd
  });

  process.stdout.on('data', (data) => {
    console.log(`[${name}] ${data.toString().trim()}`);
  });

  process.stderr.on('data', (data) => {
    console.error(`[${name} ERROR] ${data.toString().trim()}`);
  });

  process.on('close', (code) => {
    console.log(`[${name}] exited with code ${code}`);
  });

  return process;
}

console.log('Starting blockchain simulation...');

// Start central server
const serverProcess = runCommand('node', ['central_server.js'], 'SERVER', __dirname);

// Give the server a moment to start up
setTimeout(() => {
  // Start miner
  const minerProcess = runCommand('node', ['miner_server.js'], 'MINER', __dirname);

  // Start React client (assuming you're using Create React App)
  const clientProcess = runCommand('npm', ['start'], 'CLIENT', path.join(__dirname, '..'));

  // Handle script termination
  process.on('SIGINT', () => {
    console.log('Stopping all processes...');
    serverProcess.kill();
    minerProcess.kill();
    clientProcess.kill();
    process.exit();
  });
}, 2000);

console.log('All components started. Press Ctrl+C to stop.');

// MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx8vfRSHueevB2pvNcXfM5u3t8PXqM5z8HXAxHYEVWF7h3DZHwt0hgvcLzP/P18nTfpxcbXE0xvQmGwMpW9LJNlRgNijROVGBxp3WL+W7UEHBFcmfp7k04k8I5jDvq0ueZU4MDj5KkOG4W9U1Bv103SN3/wL29w4OVS6nSP6uLrmcyxogHMvD80LlkSV3OkG8Oq3kXkexQVrx/EKYF8+sI03BwQVHg9Ps1aZGhCqXNTIVFJOB6nkhIAPmH/9fPNSKHDhXoQ5nrhxzwLlQtZO0Xp2KX0Zy3S2FhxJ8PjITyZjSc6NKfMdNzwCJKGNNBDhNj3nBwVHHZFtj1SLh0+pKqQIDAQAB