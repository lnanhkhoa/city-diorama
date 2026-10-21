export interface PosterText {
  country: string;
  city: string;
  date: string;
  temp: string;
  iconSvg: string;
  ink: string;
  bg: [string, string];
}

const W = 1080;
const H = 1350;
/** Size of the 3D view drawn under the title block; render snapshots at this size. */
export const POSTER_VIEW = { w: W, h: H - 270 };

/**
 * Compose a 4:5 poster (background, 3D view, title block) like the reference
 * prints, and resolve it as a PNG blob.
 */
export async function composePoster(view: HTMLCanvasElement, t: PosterText): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;

  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, t.bg[0]);
  grad.addColorStop(1, t.bg[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // The view is rendered at POSTER_VIEW size; anchor it to the bottom edge.
  g.drawImage(view, 0, H - view.height, view.width, view.height);

  await document.fonts.ready;
  g.fillStyle = t.ink;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.globalAlpha = 0.7;
  g.font = '500 24px "Montserrat Variable", Montserrat, sans-serif';
  g.fillText(t.country.toUpperCase(), W / 2, 130);
  g.globalAlpha = 1;
  g.font = '800 112px "Montserrat Variable", Montserrat, sans-serif';
  fitText(g, t.city.toUpperCase(), W - 120, 112);
  g.fillText(t.city.toUpperCase(), W / 2, 240);

  const icon = await svgImage(t.iconSvg, t.ink);
  g.drawImage(icon, W / 2 - 38, 262, 76, 76);
  g.globalAlpha = 0.7;
  g.font = '500 24px "Montserrat Variable", Montserrat, sans-serif';
  g.fillText(t.date, W / 2, 378);
  g.globalAlpha = 1;
  g.font = '500 48px "Montserrat Variable", Montserrat, sans-serif';
  g.fillText(t.temp, W / 2, 434);

  const { promise, resolve, reject } = Promise.withResolvers<Blob>();
  c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  return promise;
}

function fitText(g: CanvasRenderingContext2D, text: string, max: number, size: number): void {
  while (g.measureText(text).width > max && size > 40) {
    size -= 4;
    g.font = `800 ${size}px "Montserrat Variable", Montserrat, sans-serif`;
  }
}

function svgImage(svg: string, color: string): Promise<HTMLImageElement> {
  const src = svg.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" color="${color}" `);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
  return img.decode().then(() => img);
}
