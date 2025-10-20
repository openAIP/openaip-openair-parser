import { defineConfig } from 'vite';
import { coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['lcov', 'text', 'html'],
            // extend the default vitest coverage exclude pattern
            exclude: [...coverageConfigDefaults.exclude],
        },
    },
});
