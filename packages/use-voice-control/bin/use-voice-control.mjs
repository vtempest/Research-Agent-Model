#!/usr/bin/env node
/**
 * @fileoverview Launcher for the `use-voice-control` command.
 *
 * The command itself is built into `dist/cli.js`; this file exists so the
 * shebang lives in a plain, never-bundled file and so a missing build fails with
 * an instruction rather than a module-resolution error.
 */
let runCli;
try {
  ({ runCli } = await import(new URL("../dist/cli.js", import.meta.url).href));
} catch (error) {
  process.stderr.write(
    "use-voice-control: the package is not built — run `npm run build` in " +
      `packages/use-voice-control first.\n(${error?.message ?? error})\n`
  );
  process.exit(1);
}

process.exitCode = await runCli(process.argv.slice(2));
