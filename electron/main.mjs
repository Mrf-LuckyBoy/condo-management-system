import { app, BrowserWindow, dialog } from "electron";
import { createRequire } from "node:module";
import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

let serverProcess;
let mainWindow;
let appUrl;
let serverOutput = "";
let serverError;

function getPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function initializeDatabase() {
  // Electron's production dependencies are packaged with this entry point.
  // Next's traced server output does not include dependencies used only here.
  const requireFromElectron = createRequire(import.meta.url);
  const { createClient } = requireFromElectron("@libsql/client");
  const databasePath = path.join(app.getPath("userData"), "condo.db");
  const client = createClient({ url: `file:${databasePath}` });

  try {
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='buildings'",
    );
    if (result.rows.length === 0) {
      const migrationPath = path.join(process.resourcesPath, "database", "migration.sql");
      await client.executeMultiple(await fs.readFile(migrationPath, "utf8"));
    }
  } finally {
    client.close();
  }

  return `file:${databasePath}`;
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (serverError) throw serverError;
    if (serverProcess.exitCode !== null) {
      throw new Error(`Next.js server exited with code ${serverProcess.exitCode}\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${url}/api/healthcheck`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Timed out waiting for a healthy Condo Management server.\n${serverOutput}`);
}

async function startApp() {
  if (!app.isPackaged) {
    appUrl = "http://127.0.0.1:3000";
    await new Promise((resolve) => setTimeout(resolve, 1200));
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 900,
      minHeight: 640,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    await mainWindow.loadURL(appUrl);
    return;
  }

  const port = await getPort();
  const serverDir = path.join(process.resourcesPath, "next-app");
  const databaseUrl = await initializeDatabase();

  serverProcess = spawn(process.execPath, [path.join(serverDir, "server.js")], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      DATABASE_URL: databaseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [serverProcess.stdout, serverProcess.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      serverOutput = (serverOutput + chunk).slice(-8000);
      process.stderr.write(chunk);
    });
  }
  serverProcess.on("error", (error) => { serverError = error; });

  appUrl = `http://127.0.0.1:${port}`;
  await waitForServer(appUrl);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await mainWindow.loadURL(appUrl);
}

app.whenReady().then(startApp).catch(async (error) => {
  await dialog.showMessageBox({
    type: "error",
    title: "Condo Management could not start",
    message: error.message,
  });
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess && serverProcess.exitCode === null) serverProcess.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && appUrl) {
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 900,
      minHeight: 640,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    mainWindow.loadURL(appUrl);
  }
});
