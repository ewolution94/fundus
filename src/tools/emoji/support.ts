// Which emoji this device can draw: each newer Emoji version's sample is drawn on a canvas, newest
// first; the first that comes out as one glyph in colour is the newest the device knows. A device
// without colour emoji at all (or a browser that blurs what a canvas reads) shows them all.

export const EMOJI_FACE = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

export function newestShown(samples: [number, string][]): number {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 40;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return Infinity;
    ctx.font = `32px ${EMOJI_FACE}`;
    ctx.textBaseline = 'top';
    const one = ctx.measureText('😀').width;
    const coloured = (s: string) => {
      ctx.clearRect(0, 0, 80, 40);
      ctx.fillStyle = '#000';
      ctx.fillText(s, 0, 0);
      const px = ctx.getImageData(0, 0, 80, 40).data;
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 0 && (px[i] !== px[i + 1] || px[i + 1] !== px[i + 2])) return true;
      return false;
    };
    if (!one || !coloured('😀')) return Infinity;
    for (const [version, s] of samples) if (ctx.measureText(s).width < one * 1.4 && coloured(s)) return version;
    return samples.at(-1)?.[0] ?? Infinity;
  } catch {
    return Infinity;
  }
}
