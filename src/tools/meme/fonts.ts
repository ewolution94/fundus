// The meme's faces. Anton (OFL, @fontsource/anton) comes only with this tool: a file of our own,
// added to the page's fonts and loaded before anything is drawn. The caption's Schibsted Grotesk is
// the page's own face; a canvas only draws it once it's loaded too.

import antonUrl from '@fontsource/anton/files/anton-latin-400-normal.woff2?url';

export const ANTON = "Anton, Impact, 'Arial Narrow', sans-serif";
export const CAPTION = "'Schibsted Grotesk Variable', 'Helvetica Neue', Arial, sans-serif";

let anton: Promise<void> | null = null;

/** Anton in the page's fonts, loaded. Once per page; a failed load tries again next time. */
export function loadAnton(): Promise<void> {
  anton ??= (async () => {
    const face = new FontFace('Anton', `url(${antonUrl}) format('woff2')`, { weight: '400', style: 'normal' });
    document.fonts.add(face);
    await face.load();
  })().catch((error) => {
    anton = null;
    throw error;
  });
  return anton;
}

/** Both faces, ready for a canvas. */
export async function loadFaces(): Promise<void> {
  await Promise.all([loadAnton(), document.fonts.load(`600 100px ${CAPTION}`)]);
}
