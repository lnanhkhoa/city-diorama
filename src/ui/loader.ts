/** Loads shorter than this finish before the indicator appears, so cached cities never flash it. */
const SHOW_DELAY_MS = 150;
/** Time for the completed bar to fill and fade before the indicator resets. */
const FINISH_MS = 450;

/**
 * Centered "Loading <city>" pill with a progress bar. Chunk downloads report no
 * byte progress, so the bar eases towards 90% in CSS (it keeps moving on the
 * compositor while the scene builds on the main thread) and fills on `done`.
 */
export class LoadingIndicator {
  private delay = 0;
  private finish = 0;

  constructor(
    private readonly el: HTMLElement,
    private readonly label: HTMLElement,
  ) {}

  start(name: string): void {
    clearTimeout(this.delay);
    if (this.el.classList.contains('show') && !this.el.classList.contains('done')) {
      // Already visible for an earlier city: keep the bar running, retarget the label.
      this.label.textContent = `Loading ${name}`;
      return;
    }
    this.delay = window.setTimeout(() => {
      clearTimeout(this.finish);
      this.el.classList.remove('show', 'done');
      this.label.textContent = `Loading ${name}`;
      // Commit the empty bar so the trickle transition starts from zero.
      void this.el.offsetWidth;
      this.el.classList.add('show');
    }, SHOW_DELAY_MS);
  }

  done(): void {
    clearTimeout(this.delay);
    if (!this.el.classList.contains('show') || this.el.classList.contains('done')) return;
    this.el.classList.add('done');
    this.finish = window.setTimeout(() => {
      this.el.classList.remove('show', 'done');
      this.label.textContent = '';
    }, FINISH_MS);
  }
}
