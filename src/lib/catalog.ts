// The catalogue (shared/catalog.mjs) for the page: typed, with the chips' counts and the developer
// shelf's switch applied.

import { CHIPS, TOOLS, articleNo, toolById, toolByPath } from '../../shared/catalog.mjs';
import { shared } from './settings.svelte.ts';

export { CHIPS, TOOLS, articleNo, toolById, toolByPath };

export type Tool = (typeof TOOLS)[number];
export type ChipId = Tool['chip'];

/** The tools the home lists: the developer shelf only with its switch on. A tool's own address
 *  opens it either way. */
export const listed = () => TOOLS.filter((t) => t.chip !== 'dev' || shared.dev);

export const chipOf = (tool: Tool) => CHIPS.find((c) => c.id === tool.chip)!;

/** The address of a tool. */
export const href = (tool: Tool) => `/${tool.path}`;
