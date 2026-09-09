/* eslint-disable no-console */

/**
 * Seeds run as a standalone script outside the Nest logger, so a tiny console wrapper
 * keeps output readable without pulling the whole DI container in.
 */
export class SeedLogger {
  section(title: string): void {
    console.log(`\n▸ ${title}`);
  }

  step(message: string): void {
    console.log(`  · ${message}`);
  }

  done(message: string): void {
    console.log(`\n✓ ${message}\n`);
  }

  fail(message: string): void {
    console.error(`\n✗ ${message}\n`);
  }
}
