import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { Locale } from '../constants/locales';
import { pdfFooterTemplate, pdfHeaderTemplate } from './pdf-template';

/**
 * HTML-to-PDF via headless Chromium (`17`: "pdf via a headless-Chromium HTML template"). One
 * browser process shared across every render rather than one per request — launching Chromium
 * takes real time, and a report export is not the place to pay that on every call.
 *
 * `puppeteer` is deliberately pinned to the last `24.x` release (see `package.json`) rather than
 * the newer `25.x` line: from `25.x` on, the package ships ESM-only, and this project's `module:
 * commonjs` build — plus Jest, which cannot `require()` an ESM package at all without
 * `--experimental-vm-modules` — has no clean way to consume it. `npm audit` will flag a
 * high-severity advisory in `extract-zip`, a transitive dependency `@puppeteer/browsers` uses
 * solely to unpack the Chromium binary it downloads from Google's own CDN at install/first-launch
 * time; it is not reachable through any request this API serves. Revisit this pin if/when the
 * project moves to native ESM or enables Jest's experimental VM-modules support.
 */
@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRendererService.name);
  private browserPromise: Promise<Browser> | null = null;

  async render(html: string, locale: Locale): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'load' });
      // `page.pdf()` can snapshot before an embedded `@font-face` has finished parsing, which is
      // the usual cause of a PDF that renders with tofu boxes despite the font being present in
      // the HTML — waiting for the browser's own font-loading promise is the documented fix.
      await page.evaluateHandle('document.fonts.ready');

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: pdfHeaderTemplate(),
        footerTemplate: pdfFooterTemplate(locale),
        margin: { top: '16px', bottom: '48px', left: '16px', right: '16px' },
      });

      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer
        .launch({
          headless: true,
          // A container commonly runs as root, where Chromium's own sandbox refuses to start at
          // all; the process is still isolated at the container boundary. Not needed, and not
          // applied, for the local/dev/e2e case, but harmless there either way.
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        .catch((error: unknown) => {
          this.browserPromise = null;
          throw error;
        });
    }

    return this.browserPromise;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.browserPromise) return;

    try {
      const browser = await this.browserPromise;
      await browser.close();
    } catch (error) {
      this.logger.warn({ err: error }, 'Error while closing the PDF renderer browser');
    }
  }
}
