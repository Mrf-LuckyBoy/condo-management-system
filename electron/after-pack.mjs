import fs from "node:fs/promises";
import path from "node:path";

async function checkDependencyLinks(directory) {
  const broken = [];

  async function visit(currentDirectory) {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name);

      if (entry.isSymbolicLink()) {
        try {
          await fs.stat(entryPath);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          broken.push(entryPath);
        }
        continue;
      }

      if (entry.isDirectory()) await visit(entryPath);
    }
  }

  await visit(directory);
  if (broken.length > 0) {
    throw new Error(`Cannot publish an app with broken dependency links:\n${broken.join("\n")}`);
  }
}

export default async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const serverDir = path.join(
    context.packager.getResourcesDir(context.appOutDir), "next-app",
  );
  // electron-builder's resource filters omit nested node_modules. Copy the
  // complete traced server ourselves and materialize links for portability.
  // This directory is generated build output, never the user's database.
  await fs.rm(serverDir, { recursive: true, force: true });
  await fs.cp(path.join(projectDir, ".next", "standalone"), serverDir, {
    recursive: true,
    dereference: true,
  });
  await fs.cp(path.join(projectDir, ".next", "static"), path.join(serverDir, ".next", "static"), {
    recursive: true,
    dereference: true,
  });
  await fs.cp(path.join(projectDir, "public"), path.join(serverDir, "public"), {
    recursive: true,
    dereference: true,
  });
  await checkDependencyLinks(context.appOutDir);
}
