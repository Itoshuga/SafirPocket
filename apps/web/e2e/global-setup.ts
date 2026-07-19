import { spawn } from 'node:child_process';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';

const e2ePort = 3100;
const e2eUrl = `http://127.0.0.1:${e2ePort}`;
const webRoot = path.resolve(__dirname, '..');
const nextBin = path.resolve(webRoot, 'node_modules/next/dist/bin/next');
const e2eEnv = {
  ...process.env,
  E2E_MOCK_AUTH_SECRET: 'safir-pocket-local-e2e',
  E2E_ALLOW_MOCK_AUTH: 'true',
};

function runNext(args: string[], stdio: 'inherit' | 'ignore') {
  return spawn(process.execPath, [nextBin, ...args], {
    cwd: webRoot,
    env: e2eEnv,
    stdio,
    windowsHide: true,
  });
}

function waitForExit(child: ReturnType<typeof runNext>) {
  return new Promise<number | null>((resolve) => child.once('exit', resolve));
}

export default async function globalSetup(_config: FullConfig) {
  const build = runNext(['build'], 'inherit');
  const buildCode = await waitForExit(build);
  if (buildCode !== 0) throw new Error(`Next.js E2E build failed with exit code ${buildCode}.`);

  const server = runNext(['start', '--port', String(e2ePort)], 'ignore');
  const serverExit = waitForExit(server);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error('Next.js E2E server exited before becoming ready.');
    try {
      const response = await fetch(e2eUrl);
      if (response.ok) break;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (Date.now() >= deadline) throw new Error('Next.js E2E server did not become ready in time.');

  return async () => {
    if (server.exitCode === null) server.kill('SIGTERM');
    await Promise.race([serverExit, new Promise((resolve) => setTimeout(resolve, 5_000))]);
  };
}
