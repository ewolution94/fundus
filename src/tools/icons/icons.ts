// How Make icons lays one picture into each icon, writes the ICO, and what it says to put in a page.
// Plain TypeScript with erasable types, so the tests run it as it is.
//
// - Every icon is square. A picture that isn't gets Fit (all of it, centred, the rest transparent or
//   the ground) or Fill (cropped to its middle).
// - The Apple icon and the maskable one stand on a solid ground: iOS paints transparency black, and
//   Android masks a maskable icon to any shape, so it needs a full square. The others keep
//   transparency.
// - A maskable icon's safe zone is the circle of 80 % in its middle (the manifest spec): the picture
//   goes inside it whole, its corners on the circle, so no mask cuts it.
// - The ICO holds 16, 32 and 48 px as PNG entries, which every browser since IE reads.

export type Shape = 'fit' | 'fill';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The share of a maskable icon's width its safe circle spans. */
export const SAFE = 0.8;

/**
 * Where a picture of `width` × `height` goes in a square icon of `size`: the box it shows in
 * (anything outside is cut) and where it's drawn (beyond the box for Fill). `safe` puts the box
 * inside the maskable safe circle.
 */
export function place(width: number, height: number, size: number, shape: Shape, safe = false): { box: Rect; draw: Rect } {
  // What shows: the whole picture's shape for Fit, a square of its middle for Fill.
  const aspect = shape === 'fill' ? 1 : width / height;
  let bw: number;
  let bh: number;
  if (safe) {
    // The box's diagonal is the circle's diameter.
    bh = (size * SAFE) / Math.sqrt(1 + aspect * aspect);
    bw = bh * aspect;
  } else if (aspect >= 1) {
    bw = size;
    bh = size / aspect;
  } else {
    bh = size;
    bw = size * aspect;
  }
  const box = { x: (size - bw) / 2, y: (size - bh) / 2, w: bw, h: bh };
  const scale = shape === 'fill' ? Math.max(bw / width, bh / height) : Math.min(bw / width, bh / height);
  const w = width * scale;
  const h = height * scale;
  return { box, draw: { x: box.x + (bw - w) / 2, y: box.y + (bh - h) / 2, w, h } };
}

/** The favicon's sizes, all in the one ICO. */
export const FAVICON_SIZES = [16, 32, 48];

export interface Icon {
  name: string;
  size: number;
  /** On the ground colour (else transparent where the picture is). */
  ground: boolean;
  /** Inside the maskable safe zone. */
  safe: boolean;
}

/** The PNG icons, besides the favicon. */
export const ICONS: Icon[] = [
  { name: 'apple-touch-icon.png', size: 180, ground: true, safe: false },
  { name: 'icon-192.png', size: 192, ground: false, safe: false },
  { name: 'icon-512.png', size: 512, ground: false, safe: false },
  { name: 'icon-maskable-512.png', size: 512, ground: true, safe: true },
];

export const MANIFEST = 'manifest.webmanifest';

/** What the ZIP holds, in order, with each file's pixel sizes (none for the SVG and the manifest). */
export function contents(svg: boolean): { name: string; sizes: number[] }[] {
  return [
    { name: 'favicon.ico', sizes: FAVICON_SIZES },
    ...(svg ? [{ name: 'favicon.svg', sizes: [] }] : []),
    ...ICONS.map((i) => ({ name: i.name, sizes: [i.size] })),
    { name: MANIFEST, sizes: [] },
  ];
}

/**
 * An ICO file from PNGs: the ICONDIR (reserved, type 1, count), one 16-byte ICONDIRENTRY each
 * (width and height, 0 meaning 256; no palette; 1 plane; 32 bits; the PNG's length and where it
 * starts), then the PNGs as they are.
 */
export function ico(images: { size: number; png: Uint8Array }[]): Uint8Array {
  const head = 6 + 16 * images.length;
  const out = new Uint8Array(head + images.reduce((n, i) => n + i.png.length, 0));
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);
  let offset = head;
  images.forEach((image, k) => {
    const at = 6 + 16 * k;
    out[at] = image.size >= 256 ? 0 : image.size;
    out[at + 1] = image.size >= 256 ? 0 : image.size;
    out[at + 2] = 0;
    out[at + 3] = 0;
    view.setUint16(at + 4, 1, true);
    view.setUint16(at + 6, 32, true);
    view.setUint32(at + 8, image.png.length, true);
    view.setUint32(at + 12, offset, true);
    out.set(image.png, offset);
    offset += image.png.length;
  });
  return out;
}

/** The tags for a page's <head>. With an SVG, the ICO says 32x32 so browsers that read SVG take it. */
export function linkTags(svg: boolean): string {
  return [
    svg ? '<link rel="icon" href="/favicon.ico" sizes="32x32">' : '<link rel="icon" href="/favicon.ico">',
    ...(svg ? ['<link rel="icon" href="/favicon.svg" type="image/svg+xml">'] : []),
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    `<link rel="manifest" href="/${MANIFEST}">`,
  ].join('\n');
}

const manifestIcon = (i: Icon) => ({ src: `/${i.name}`, sizes: `${i.size}x${i.size}`, type: 'image/png', ...(i.safe ? { purpose: 'maskable' } : {}) });

/** The icons a web app manifest lists: the Apple icon is for iOS's tag, not the manifest. */
const listed = () => ICONS.filter((i) => i.name !== 'apple-touch-icon.png');

/** The manifest's "icons" entry, to paste into a manifest there is already. */
export function manifestIcons(): string {
  return `"icons": ${JSON.stringify(listed().map(manifestIcon), null, 2)}`;
}

/** A manifest to start from: the name (the picture's, to change) and the icons. */
export function manifest(name: string): string {
  return `${JSON.stringify({ name, icons: listed().map(manifestIcon) }, null, 2)}\n`;
}

/** "#rrggbb" for a colour's channels. */
export const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

/** The ground "from the picture": its corner pixel when that's opaque, else null (white then). */
export function groundFrom(rgba: ArrayLike<number>): string | null {
  return rgba[3] === 255 ? hex(rgba[0], rgba[1], rgba[2]) : null;
}
