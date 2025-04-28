export default {
    printWidth: 120,
    useTabs: false,
    semi: true,
    arrowParens: 'always',
    tabWidth: 4,
    singleQuote: true,
    trailingComma: 'es5',
    plugins: ['@ianvs/prettier-plugin-sort-imports'],
    importOrder: ['<BUILTIN_MODULES>', '<THIRD_PARTY_MODULES>', '^@/.*$', '^[.]'],
};
