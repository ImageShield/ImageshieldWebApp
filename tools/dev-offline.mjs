/**
 * `next dev` and the /v1 fixture, as one command that cleans up after itself.
 *
 * A shell one-liner (`fixture & next dev`) very nearly works, and its failure mode is
 * the annoying kind: whether Ctrl-C reaches the backgrounded fixture depends on
 * process-group behaviour that differs between shells and between interactive and
 * non-interactive runs. When it doesn't, the fixture is orphaned holding port 5099
 * and the NEXT run of this command silently talks to a stale server. Supervising both
 * from Node makes shutdown explicit instead of incidental.
 *
 * Not a production concern in any way - this file is only ever run by `npm run
 * dev:offline`.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.DEV_API_PORT ?? "5099";

const children = [];
let stopping = false;

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  children.push(child);
  return child;
}

function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
}

const api = start(process.execPath, [join("tools", "dev-api", "server.mjs")], {
  DEV_API_PORT: PORT,
});

const web = start(join("node_modules", ".bin", "next"), ["dev"], {
  IMAGESHIELD_API_URL: `http://localhost:${PORT}`,
});

/* The fixture dying on its own is nearly always "port already in use", and the dev
   server would otherwise carry on talking to nothing - or worse, to whatever is
   already on that port. Take the pair down and say why. */
api.on("exit", (code) => {
  if (stopping) return;
  console.error(
    `\n  The /v1 fixture exited (code ${String(code)}). If port ${PORT} is already in ` +
      `use, stop what is on it - or set DEV_API_PORT to something else.\n`,
  );
  stopAll();
  process.exitCode = code ?? 1;
});

web.on("exit", (code) => {
  stopAll();
  process.exitCode = code ?? 0;
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, stopAll);
}
process.on("exit", stopAll);
