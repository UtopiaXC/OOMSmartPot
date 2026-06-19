import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW Node server for Vitest / Jest test environments.
 * Import and start in test setup or individual test files.
 */
export const server = setupServer(...handlers);
