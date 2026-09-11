import path from "path";

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __signalSponsorPrisma: PrismaClient | undefined;
}

function resolveSqliteDatasourceUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  const rawValue = databaseUrl.slice("file:".length);
  const queryIndex = rawValue.indexOf("?");
  const rawPath = queryIndex === -1 ? rawValue : rawValue.slice(0, queryIndex);
  const rawQuery = queryIndex === -1 ? "" : rawValue.slice(queryIndex);

  if (
    !rawPath ||
    rawPath.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(rawPath)
  ) {
    return databaseUrl;
  }

  const normalizedPath = rawPath.startsWith("./prisma/") || rawPath.startsWith("prisma/")
    ? path.resolve(process.cwd(), rawPath.replace(/^\.\//, ""))
    : path.resolve(process.cwd(), "prisma", rawPath);

  return `file:${normalizedPath}${rawQuery}`;
}

const resolvedDatabaseUrl = resolveSqliteDatasourceUrl(process.env.DATABASE_URL ?? "file:./dev.db");
process.env.DATABASE_URL = resolvedDatabaseUrl;

export const prisma =
  global.__signalSponsorPrisma ??
  new PrismaClient({
    datasourceUrl: resolvedDatabaseUrl,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__signalSponsorPrisma = prisma;
}
