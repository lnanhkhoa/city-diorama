import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export type WeatherGroup = 'weather' | 'time';

interface Item {
  group: WeatherGroup;
  value: string;
  label: string;
}

/** Each group's first option is its default: `current` follows live/typical weather, `local` each city's clock. */
const GROUPS: { id: WeatherGroup; label: string; options: [value: string, label: string][] }[] = [
  {
    id: 'weather',
    label: 'Condition',
    options: [
      ['current', 'Current'],
      ['clear', 'Clear'],
      ['cloudy', 'Overcast'],
      ['fog', 'Fog'],
      ['rain', 'Rain'],
      ['snow', 'Snow'],
    ],
  },
  {
    id: 'time',
    label: 'Time of day',
    options: [
      ['local', 'Local time'],
      ['dawn', 'Dawn'],
      ['day', 'Day'],
      ['dusk', 'Dusk'],
      ['night', 'Night'],
      ['dark', 'Dark'],
    ],
  },
];
const ITEMS: Item[] = GROUPS.flatMap((g) => g.options.map(([value, label]) => ({ group: g.id, value, label })));
const DEFAULT_LABEL = ITEMS[0].label;
const itemId = (item: Item) => `weather-list-${item.group}-${item.value}`;

interface Props {
  value: Record<WeatherGroup, string>;
  onChange: (group: WeatherGroup, value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Themed dropdown of independent radio groups (condition, time of day). The
 * button shows the non-default choices, or "Current" when every group is at
 * its default. Focus stays on the menu and the highlighted item is tracked
 * with `aria-activedescendant`: arrows, Home/End and type-ahead move it,
 * Enter/Space choose, Escape or Tab or an outside click close.
 */
export function WeatherMenu({ value, onChange, open, onOpenChange }: Props) {
  const [active, setActive] = useState(-1);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const checked = (item: Item) => value[item.group] === item.value;

  const show = () => {
    setActive(Math.max(0, ITEMS.findIndex(checked)));
    onOpenChange(true);
  };
  /** `refocus` returns focus to the button (keyboard close); outside clicks leave it where it landed. */
  const close = (refocus: boolean) => {
    onOpenChange(false);
    if (refocus) button.current!.focus();
  };
  const choose = (i: number) => {
    const item = ITEMS[i];
    close(true);
    if (!checked(item)) onChange(item.group, item.value);
  };

  useEffect(() => {
    if (open) list.current!.focus();
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(itemId(ITEMS[active]))?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!list.current!.contains(t) && !button.current!.contains(t)) onOpenChange(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, onOpenChange]);

  const onKey = (e: KeyboardEvent) => {
    const last = ITEMS.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        setActive(Math.min(last, active + 1));
        break;
      case 'ArrowUp':
        setActive(Math.max(0, active - 1));
        break;
      case 'Home':
        setActive(0);
        break;
      case 'End':
        setActive(last);
        break;
      case 'Enter':
      case ' ':
        choose(active);
        break;
      case 'Escape':
        close(true);
        break;
      case 'Tab':
        close(false);
        return;
      default: {
        if (e.key.length !== 1 || e.altKey || e.metaKey || e.ctrlKey) return;
        // Type-ahead: next item after the highlight starting with the key.
        const k = e.key.toLowerCase();
        for (let n = 1; n <= ITEMS.length; n++) {
          const i = (active + n) % ITEMS.length;
          if (ITEMS[i].label.toLowerCase().startsWith(k)) {
            setActive(i);
            break;
          }
        }
      }
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const chosen = GROUPS.flatMap((g) => {
    const item = ITEMS.find((x) => x.group === g.id && checked(x));
    return item && item.value !== g.options[0][0] ? [item.label] : [];
  });

  return (
    <div className="weather-menu">
      <button
        ref={button}
        className="menu-btn weather-btn"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="weather-list"
        title="Weather and time of day"
        onClick={() => (open ? close(true) : show())}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          show();
        }}
      >
        <span>{chosen.join(' · ') || DEFAULT_LABEL}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        ref={list}
        id="weather-list"
        className="weather-list"
        role="menu"
        aria-label="Weather and time of day"
        aria-activedescendant={open && active >= 0 ? itemId(ITEMS[active]) : undefined}
        tabIndex={-1}
        hidden={!open}
        onKeyDown={onKey}
        onBlur={(e) => {
          if (open && !list.current!.contains(e.relatedTarget) && e.relatedTarget !== button.current) onOpenChange(false);
        }}
      >
        {GROUPS.map((g) => (
          <div key={g.id} role="group" aria-labelledby={`weather-group-${g.id}`}>
            <div id={`weather-group-${g.id}`} className="group-label" role="presentation">
              {g.label}
            </div>
            {ITEMS.map((item, i) =>
              item.group !== g.id ? null : (
                <div
                  key={item.value}
                  id={itemId(item)}
                  role="menuitemradio"
                  aria-checked={checked(item)}
                  className={i === active ? 'active' : undefined}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(i)}
                >
                  {item.label}
                </div>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
