import { test, expect } from "@playwright/test";
import { login } from "./login";
import * as fs from "node:fs";
import * as path from "node:path";

const pkgDir =
  process.env.BACKSTAGE_PACKAGE_DIR ??
  path.resolve(
    process.cwd(),
    "../carmen-turborepo-backend/packages/prisma-shared-schema-backstage",
  );

test.skip(
  !fs.existsSync(path.join(pkgDir, "package.json")),
  "platform package not present — set BACKSTAGE_PACKAGE_DIR or check out the sibling repo",
);

// The assertions below allow 60s for a subprocess run, which the default 30s test
// budget could never honour — the test died before its own waits expired.
test.setTimeout(120_000);

test("runs read-only prisma migration status and streams output", async ({
  page,
}) => {
  await login(page);

  await page.goto("/platform-migrations");

  // The target banner reflects the selected schema (defaults to the system schema).
  await expect(page.getByText(/schema/i).first()).toBeVisible();

  // Select the read-only "Prisma: migration status" operation.
  await page.getByLabel(/Prisma: migration status/i).check();
  await page.getByRole("button", { name: /^Run$/i }).click();

  // The live log <pre role="log"> should appear and the run should finish.
  await expect(page.getByRole("log")).toBeVisible({ timeout: 60_000 });
  // Match the app's own summary line, which ends in "on schema <name>". The old regex
  // also matched the subprocess output inside <pre role="log">, and two hits trip
  // strict mode. Scoping by role="status" would not help: the persistent live-target
  // bar carries that role too.
  await expect(
    page.getByText(/completed \(exit 0\) on schema/i),
  ).toBeVisible({ timeout: 60_000 });
});
