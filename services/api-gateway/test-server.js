// Quick test to see if the server can start
const { spawn } = require('child_process');

console.log('Testing server startup...');

const child = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  cwd: process.cwd()
});

let output = '';
let hasStarted = false;

child.stdout.on('data', (data) => {
  output += data.toString();
  console.log('STDOUT:', data.toString());
  
  if (data.toString().includes('Server listening') || data.toString().includes('listening at')) {
    hasStarted = true;
    console.log('✅ Server started successfully!');
    child.kill();
    process.exit(0);
  }
});

child.stderr.on('data', (data) => {
  output += data.toString();
  console.log('STDERR:', data.toString());
  
  if (data.toString().includes('TSError') || data.toString().includes('error TS')) {
    console.log('❌ TypeScript compilation failed');
    child.kill();
    process.exit(1);
  }
});

child.on('close', (code) => {
  if (!hasStarted) {
    console.log(`❌ Process exited with code ${code}`);
    console.log('Output:', output);
    process.exit(1);
  }
});

// Timeout after 30 seconds
setTimeout(() => {
  if (!hasStarted) {
    console.log('⏰ Timeout - killing process');
    child.kill();
    process.exit(1);
  }
}, 30000);
