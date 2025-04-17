import eslint from '@eslint/js';
import pluginSecurity from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    pluginSecurity.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: ['**/*.js', '**/*.cjs', '**/*.mjs'],
        rules: {
            '@typescript-eslint/consistent-type-assertions': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/strict-boolean-expressions': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/naming-convention': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'security/detect-object-injection': 'off',
            'security/detect-unsafe-regex': 'off',
            'security/detect-possible-timing-attacks': 'off',
            'security/detect-non-literal-regexp': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            'no-useless-escape': 'off',
        },
    }
);
