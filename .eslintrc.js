module.exports = {
    root: true,
    env: {
        node: true,
        es2017: true,
        jest: true,
        mongo: true,
    },
    parserOptions: {
        ecmaVersion: 2017,
        requireConfigFile: false,
    },
    // required for eslint to understand ES6-7 specific language features like "{ ...object }"
    parser: '@babel/eslint-parser',
    plugins: ['only-warn'],
    extends: ['plugin:prettier/recommended', 'eslint:recommended', 'plugin:import/errors', 'plugin:import/warnings'],
    rules: {
        'require-atomic-updates': 'off',
        'no-unused-vars': 'warn',
    },
};
