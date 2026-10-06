// Phase 2A backend smoke test.
//
// Spawns the real server (node server.js), hits /api/health, asserts the exact
// JSON contract, checks unknown-API 404 behaviour, verifies graceful shutdown
// of the standalone process, and exercises the exported start() path
// in-process. The existing Phase 1 specs are unchanged - this spec is additive.
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');

/** Spawn `node server.js` with PORT=0 and resolve once it is listening. */
function spawnServer() {
  const child = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });

  const port = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('server did not start in 15s. stdout: ' + stdout + ' stderr: ' + stderr));
    }, 15000);
    child.stdout.on('data', () => {
      const m = stdout.match(/listening on port (\d+)/);
      if (m) { clearTimeout(timer); resolve(Number(m[1])); }
    });
    child.on('exit', code => {
      clearTimeout(timer);
      reject(new Error('server exited before listening (code ' + code + '). stderr: ' + stderr));
    });
  });

  return { child, port, logs: () => ({ stdout, stderr }) };
}

test('Phase 2A backend: /api/health contract, 404s and graceful shutdown', async () => {
  const { child, port } = spawnServer();
  try {
    const base = `http://127.0.0.1:${await port}`;

    // 1. Health endpoint -> 200 + exact JSON contract.
    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
    expect(health.headers.get('content-type')).toContain('application/json');
    expect(await health.json()).toEqual({ status: 'ok', service: 'LoanFinder API' });

    // 2. Unknown API route -> clean JSON 404 (no wrapper, no stack trace).
    const missing = await fetch(`${base}/api/does-not-exist`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ status: 404, error: 'Not found' });

    // 3. Unknown static route -> clean JSON 404, nothing private served.
    const privatePath = await fetch(`${base}/package.json`);
    expect(privatePath.status).toBe(404);

    // 4. The Phase 1 index.html is served so the frontend loads over http too.
    const index = await fetch(`${base}/`);
    expect(index.status).toBe(200);
    expect(await index.text()).toContain('LoanFinder');

    // 5. The exported start() path also shuts down cleanly (same code the
    //    SIGINT/SIGTERM handlers call on POSIX builds).
    const { start } = require(SERVER);
    const inProcess = start(0);
    const inPort = await new Promise(resolve => {
      inProcess.once('listening', () => resolve(inProcess.address().port));
    });
    const inHealth = await fetch(`http://127.0.0.1:${inPort}/api/health`);
    expect(inHealth.status).toBe(200);
    await new Promise(resolve => inProcess.close(resolve));

    // 6. Standalone process shuts down when told to.
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    await Promise.race([exited, new Promise((_, r) => setTimeout(() => r(new Error('child did not exit')), 10000))]);
  } finally {
    if (child.exitCode === null && child.pid) child.kill();
  }
});