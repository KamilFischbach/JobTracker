import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { MOCK_USER, server, setMockUser } from './mock-api';

// findBy*/waitFor give up after 1 s by default, too short on shared CI
// runners for flows like log in -> redirect -> load board -> open a dialog.
configure({ asyncUtilTimeout: 3000 });

// Finish animations instantly so tests see the final UI right away.
MotionGlobalConfig.skipAnimations = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  setMockUser(MOCK_USER);
});
afterAll(() => server.close());
