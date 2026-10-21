import { useCallback, useEffect, useRef, useState } from 'react';

const SHOW_MS = 2200;

export type ShowToast = (msg: string) => void;

interface ToastState {
  msg: string;
  visible: boolean;
}

/** Message state for `<Toast>`; a new message replaces the current one. */
export function useToast(): ToastState & { show: ShowToast } {
  const [state, setState] = useState<ToastState>({ msg: '', visible: false });
  const timer = useRef(0);
  const show = useCallback<ShowToast>((msg) => {
    setState({ msg, visible: true });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState((s) => ({ ...s, visible: false })), SHOW_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { ...state, show };
}

export function Toast({ msg, visible }: ToastState) {
  return (
    <div className={visible ? 'toast show' : 'toast'} role="status">
      {msg}
    </div>
  );
}
