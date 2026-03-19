const { execSync, spawn } = require('child_process');

const port = Number(process.env.PORT || 3000);

function getListeningPidsWindows(targetPort) {
  try {
    const out = execSync(`netstat -ano -p tcp | findstr :${targetPort}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    const pids = new Set();
    out.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        // Typical row: TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
        const parts = line.split(/\s+/);
        const state = parts[3];
        const pid = Number(parts[4]);
        if (state === 'LISTENING' && Number.isInteger(pid) && pid > 0) {
          pids.add(pid);
        }
      });

    return [...pids];
  } catch {
    return [];
  }
}

function getListeningPidsUnix(targetPort) {
  try {
    const out = execSync(`lsof -ti tcp:${targetPort} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    return out
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

function killPidWindows(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function killPidUnix(pid) {
  try {
    process.kill(pid, 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

function cleanPort(targetPort) {
  const isWin = process.platform === 'win32';
  const pids = isWin ? getListeningPidsWindows(targetPort) : getListeningPidsUnix(targetPort);

  if (!pids.length) {
    console.log(`No process currently listening on port ${targetPort}.`);
    return;
  }

  pids.forEach((pid) => {
    const ok = isWin ? killPidWindows(pid) : killPidUnix(pid);
    if (ok) {
      console.log(`Stopped process PID ${pid} on port ${targetPort}.`);
    } else {
      console.log(`Could not stop PID ${pid}.`);
    }
  });
}

cleanPort(port);

const server = spawn(process.execPath, ['server.js'], {
  stdio: 'inherit',
  env: process.env
});

server.on('exit', (code) => {
  process.exit(code ?? 0);
});

server.on('error', (error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
