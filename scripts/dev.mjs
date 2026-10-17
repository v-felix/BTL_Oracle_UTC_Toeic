import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
const processes = [];
const run = (exe, args) => {
  const p = spawn(exe, args, {
    stdio: "inherit",
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: "Development" },
  });
  processes.push(p);
  p.on("exit", (code) => {
    if (code) stop(code);
  });
};
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of processes) {
    if (process.platform === "win32")
      spawn("taskkill", ["/pid", String(p.pid), "/t", "/f"], {
        stdio: "ignore",
      });
    else p.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 600);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
run("dotnet", [
  "run",
  "--project",
  "server/Toeic.Api",
  "--no-launch-profile",
  "--urls",
  "http://127.0.0.1:5080",
]);
run(process.execPath, [
  process.env.npm_execpath ||
    join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
  "run",
  "dev",
  "--workspace",
  "web",
]);
