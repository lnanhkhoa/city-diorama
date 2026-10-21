import type { CityDef } from '../cities/types';
import type { ShowToast } from './Toast';

/** Native share sheet when available, otherwise copy the link. */
export async function shareCity(city: CityDef, toast: ShowToast): Promise<void> {
  const url = location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: `${city.name} — Cities Diorama`, text: `A miniature ${city.name} in 3D`, url });
      return;
    } catch (err) {
      // Dismissing the sheet is not an error; anything else falls back to copying.
      if ((err as Error).name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    toast('Copy failed — use the address bar');
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
