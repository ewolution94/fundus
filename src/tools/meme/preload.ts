// "Everything offline": Anton loads only when the meme maker draws, so it's loaded once here, which
// leaves its file with the service worker.

import { loadAnton } from './fonts.ts';

export default () => loadAnton();
