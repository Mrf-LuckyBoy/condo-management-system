import fs from "node:fs/promises";
import path from "node:path";

async function removeDanglingSymlinks(directory) {
  let removed = 0;

  async function visit(currentDirectory) {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name);

      if (entry.isSymbolicLink()) {
        try {
          await fs.stat(entryPath);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          await fs.rm(entryPath);
          removed += 1;
        }
        continue;
      }

      if (entry.isDirectory()) await visit(entryPath);
    }
  }

  await visit(directory);
  if (removed > 0) {
    console.log(`Removed ${removed} dangling symlink(s) from the packaged app.`);
  }
}

export default async function afterPack(context) {
  await removeDanglingSymlinks(context.appOutDir);
}
