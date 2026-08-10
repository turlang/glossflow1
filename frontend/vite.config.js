import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Configuração explícita do React para produção.
 * O runtime JSX automático evita dependência de uma variável global `React`
 * em componentes e transforma JSX através de react/jsx-runtime.
 */
export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' })]
});
