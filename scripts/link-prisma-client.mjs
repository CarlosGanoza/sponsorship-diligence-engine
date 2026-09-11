import { lstat, mkdir, readlink, symlink, unlink } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();
const prismaClientPackageDir = path.join(workspaceRoot, "node_modules", "@prisma", "client");
const prismaGeneratedDir = path.join(workspaceRoot, "node_modules", ".prisma");
const prismaLinkPath = path.join(prismaClientPackageDir, ".prisma");
const relativeTarget = path.relative(prismaClientPackageDir, prismaGeneratedDir);

async function ensurePrismaLink() {
  await mkdir(prismaClientPackageDir, { recursive: true });

  try {
    const stat = await lstat(prismaLinkPath);

    if (stat.isSymbolicLink()) {
      const currentTarget = await readlink(prismaLinkPath);
      if (currentTarget === relativeTarget) {
        return;
      }
    }

    await unlink(prismaLinkPath);
  } catch {
    // Nothing to replace.
  }

  await symlink(relativeTarget, prismaLinkPath, "junction");
}

ensurePrismaLink().catch((error) => {
  console.error("Could not link Prisma client package to generated artifacts.");
  console.error(error);
  process.exitCode = 1;
});
