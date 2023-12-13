import { beforeEach, expect, test } from 'vitest';

import { getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

beforeEach(async () => {
  const cleanup = await setupEditor('edgeless');

  return cleanup;
});

test('basic assert', () => {
  expect(window.page).toBeDefined();
  expect(window.editor).toBeDefined();
  expect(window.editor.mode).toBe('edgeless');

  expect(getSurface(window.page, window.editor)).toBeDefined();
});
