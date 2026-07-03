import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Les modules testés (voice/, cooldowns/, timers/, game/) sont purs :
    // ils doivent tourner en environnement node, sans DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
