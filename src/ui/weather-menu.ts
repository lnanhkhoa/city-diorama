export interface WeatherMenuOptions {
  button: HTMLButtonElement;
  /** `role="menu"` holding `[data-group]` groups of `role="menuitemradio"` items with `data-value`. */
  list: HTMLElement;
  onChange: (group: string, value: string) => void;
}

/**
 * Themed dropdown of independent radio groups (condition, time of day)
 * replacing the OS-drawn `<select>`. The first item of each group is its
 * default; the button shows the non-default choices, or its initial text when
 * every group is at its default. Focus stays on the menu and the highlighted
 * item is tracked with `aria-activedescendant`: arrows, Home/End and
 * type-ahead move it, Enter/Space choose, Escape or Tab or an outside click
 * close.
 */
export class WeatherMenu {
  private readonly items: HTMLElement[];
  private readonly groups: HTMLElement[];
  private readonly label: HTMLElement;
  private readonly defaultLabel: string;
  private active = -1;

  constructor(private readonly o: WeatherMenuOptions) {
    this.items = [...o.list.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    this.groups = [...o.list.querySelectorAll<HTMLElement>('[data-group]')];
    this.label = o.button.querySelector('span')!;
    this.defaultLabel = this.label.textContent!;
    for (const item of this.items) item.id ||= `${o.list.id}-${this.groupOf(item)}-${item.dataset.value}`;

    o.button.addEventListener('click', () => (this.isOpen ? this.close(true) : this.open()));
    o.button.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      this.open();
    });
    o.list.addEventListener('keydown', (e) => this.onKey(e));
    o.list.addEventListener('pointermove', (e) => {
      const i = this.items.indexOf((e.target as Element).closest<HTMLElement>('[role="menuitemradio"]')!);
      if (i >= 0) this.highlight(i);
    });
    o.list.addEventListener('click', (e) => {
      const i = this.items.indexOf((e.target as Element).closest<HTMLElement>('[role="menuitemradio"]')!);
      if (i >= 0) this.choose(i);
    });
    document.addEventListener('pointerdown', (e) => {
      if (this.isOpen && !o.list.contains(e.target as Node) && !o.button.contains(e.target as Node)) this.close(false);
    });
    o.list.addEventListener('focusout', (e) => {
      if (this.isOpen && !o.list.contains(e.relatedTarget as Node) && e.relatedTarget !== o.button) this.close(false);
    });
  }

  get isOpen(): boolean {
    return !this.o.list.hidden;
  }

  get(group: string): string {
    return this.items.find((x) => this.groupOf(x) === group && x.getAttribute('aria-checked') === 'true')?.dataset.value ?? '';
  }

  /** Checks `value` in `group` without firing `onChange`; unknown values are ignored. */
  set(group: string, value: string): void {
    const mine = this.items.filter((x) => this.groupOf(x) === group);
    const item = mine.find((x) => x.dataset.value === value);
    if (!item) return;
    for (const x of mine) x.setAttribute('aria-checked', String(x === item));
    const chosen = this.groups.flatMap((g) => {
      const checked = g.querySelector<HTMLElement>('[aria-checked="true"]');
      return checked && checked !== g.querySelector('[role="menuitemradio"]') ? [checked.textContent] : [];
    });
    this.label.textContent = chosen.join(' · ') || this.defaultLabel;
  }

  open(): void {
    this.o.list.hidden = false;
    this.o.button.setAttribute('aria-expanded', 'true');
    this.highlight(Math.max(0, this.items.findIndex((x) => x.getAttribute('aria-checked') === 'true')));
    this.o.list.focus();
  }

  /** `refocus` returns focus to the button (keyboard close); outside clicks leave it where it landed. */
  close(refocus: boolean): void {
    this.o.list.hidden = true;
    this.o.button.setAttribute('aria-expanded', 'false');
    if (refocus) this.o.button.focus();
  }

  private groupOf(item: HTMLElement): string {
    return item.closest<HTMLElement>('[data-group]')!.dataset.group!;
  }

  private highlight(i: number): void {
    this.items[this.active]?.classList.remove('active');
    this.active = i;
    const item = this.items[i];
    item.classList.add('active');
    item.scrollIntoView({ block: 'nearest' });
    this.o.list.setAttribute('aria-activedescendant', item.id);
  }

  private choose(i: number): void {
    const item = this.items[i];
    const group = this.groupOf(item);
    const value = item.dataset.value!;
    const changed = value !== this.get(group);
    this.set(group, value);
    this.close(true);
    if (changed) this.o.onChange(group, value);
  }

  private onKey(e: KeyboardEvent): void {
    const last = this.items.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        this.highlight(Math.min(last, this.active + 1));
        break;
      case 'ArrowUp':
        this.highlight(Math.max(0, this.active - 1));
        break;
      case 'Home':
        this.highlight(0);
        break;
      case 'End':
        this.highlight(last);
        break;
      case 'Enter':
      case ' ':
        this.choose(this.active);
        break;
      case 'Escape':
        this.close(true);
        break;
      case 'Tab':
        this.close(false);
        return;
      default: {
        if (e.key.length !== 1 || e.altKey || e.metaKey || e.ctrlKey) return;
        // Type-ahead: next item after the highlight starting with the key.
        const k = e.key.toLowerCase();
        for (let n = 1; n <= this.items.length; n++) {
          const i = (this.active + n) % this.items.length;
          if (this.items[i].textContent!.trim().toLowerCase().startsWith(k)) {
            this.highlight(i);
            break;
          }
        }
      }
    }
    e.preventDefault();
    e.stopPropagation();
  }
}
