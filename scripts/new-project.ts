#!/usr/bin/env tsx
/* eslint-disable no-console */
import { intro, outro, text, isCancel, cancel, spinner } from "@clack/prompts";
import { execa } from "execa";
import chalk from "chalk";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const RSYNC_EXCLUDES = [
  "--exclude=.git",
  "--exclude=node_modules",
  "--exclude=.next",
  // Never carry secrets between projects. .env.example is preserved.
  "--exclude=.env",
  "--exclude=.env.local",
  "--exclude=.env.development",
  "--exclude=.env.development.local",
  "--exclude=.env.production",
  "--exclude=.env.production.local",
  "--exclude=.env.test",
  "--exclude=.env.vercel",
  "--exclude=.vercel",
  "--exclude=.turbo",
  "--exclude=coverage",
  "--exclude=playwright-report",
  "--exclude=test-results",
  "--exclude=.email-export",
  "--exclude=.claude",
  "--exclude=.DS_Store",
];

async function main() {
  intro(chalk.bold("magic-create — new project"));

  // Positional args: pnpm new-project <slug> [git-url]
  const [argSlug, argGitUrl] = process.argv.slice(2);

  const slug = argSlug ?? (await askSlug());
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    cancel(`Invalid slug "${slug}" — must be kebab-case, lowercase, starts with a letter.`);
    process.exit(1);
  }

  const displayName = slug
    .split(/-|_/)
    .map((w) => (w[0] ?? "").toUpperCase() + w.slice(1))
    .join(" ");

  const destination = path.join(path.dirname(ROOT), slug);

  const gitUrl = argGitUrl ?? (await askGitUrl());

  if (destination === ROOT) {
    cancel("Refusing to scaffold into the boilerplate itself.");
    process.exit(1);
  }

  try {
    const existing = await fs.readdir(destination);
    if (existing.length > 0) {
      cancel(`Destination ${destination} exists and is not empty.`);
      process.exit(1);
    }
  } catch {
    // directory does not exist — good
  }

  const s = spinner();

  s.start(`Copying boilerplate -> ${destination}`);
  await execa("rsync", ["-a", ...RSYNC_EXCLUDES, `${ROOT}/`, destination]);
  s.stop("Copied.");

  s.start("Renaming references");
  await replaceInFile(
    path.join(destination, "package.json"),
    /"name": "[^"]+"/,
    `"name": "${slug}"`,
  );
  await replaceInFile(
    path.join(destination, "config.ts"),
    /appName: "[^"]+"/,
    `appName: "${displayName}"`,
  );
  await replaceInFile(
    path.join(destination, "config.ts"),
    /domainName: "[^"]+"/,
    `domainName: "${slug}.com"`,
  );
  s.stop("Renamed.");

  s.start("Creating .env.local from .env.example");
  await fs.copyFile(
    path.join(destination, ".env.example"),
    path.join(destination, ".env.local"),
  );
  s.stop(".env.local created (fill in secrets later).");

  s.start("Initializing git");
  await execa("git", ["init", "-b", "main"], { cwd: destination });
  await execa("git", ["add", "."], { cwd: destination });
  await execa(
    "git",
    ["commit", "-m", "chore: initial commit from magic-create boilerplate"],
    { cwd: destination },
  );
  s.stop("git initialized.");

  if (gitUrl) {
    s.start(`Pushing to ${gitUrl}`);
    try {
      await execa("git", ["remote", "add", "origin", gitUrl], { cwd: destination });
      await execa("git", ["push", "-u", "origin", "main"], {
        cwd: destination,
        stdio: "inherit",
      });
      s.stop("Pushed.");
    } catch (err) {
      s.stop(
        `Push failed. Run manually: cd ${destination} && git push -u origin main`,
      );
      console.error(chalk.dim(`(${(err as Error).message.slice(0, 200)})`));
    }
  }

  outro(chalk.green(`${displayName} is ready`));
  console.log(
    chalk.dim(
      `\nNext:\n  cd ${destination}\n  # edit .env.local with real secrets\n  pnpm install\n  pnpm db:generate && pnpm db:migrate\n  pnpm dev\n`,
    ),
  );
}

async function askSlug() {
  const v = await text({
    message: "Project slug (kebab-case)",
    initialValue: "my-app",
    validate: (s) =>
      !s
        ? "required"
        : !/^[a-z][a-z0-9-]*$/.test(s)
          ? "lowercase letters, digits, and hyphens only"
          : undefined,
  });
  if (isCancel(v)) {
    cancel("Cancelled");
    process.exit(0);
  }
  return v as string;
}

async function askGitUrl() {
  const v = await text({
    message: "GitHub remote URL (blank to skip push)",
    placeholder: "https://github.com/you/repo.git",
    initialValue: "",
  });
  if (isCancel(v)) {
    cancel("Cancelled");
    process.exit(0);
  }
  return (v as string) || null;
}

async function replaceInFile(file: string, pat: RegExp, repl: string) {
  const buf = await fs.readFile(file, "utf8");
  await fs.writeFile(file, buf.replace(pat, repl), "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
