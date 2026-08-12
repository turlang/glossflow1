import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite e Vitest compartilham a mesma transformação JSX.
 * JSDOM fica restrito aos testes; o build de produção continua browser-first.
 */
export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' })],
  test: {
    environment: 'jsdom',
    restoreMocks: true,
    clearMocks: true
  }
});
