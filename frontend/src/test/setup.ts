import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Sin globals de Vitest, Testing Library no desmonta solo entre tests
afterEach(() => {
  cleanup();
});

// APIs del navegador que Mantine usa y jsdom no trae
// (https://mantine.dev/guides/vitest/)
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

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;

window.HTMLElement.prototype.scrollIntoView = () => {};

const { getComputedStyle } = window;
window.getComputedStyle = (elt) => getComputedStyle(elt);
