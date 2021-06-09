module.exports = {
    root: true,
    env: {
        node: true,
        es2017: true,
        jest: true,
        mongo: true
    },
    parserOptions: {
        ecmaVersion: 2017
    },
    // required for eslint to understand ES6-7 specific language features like "{ ...object }"
    parser: 'babel-eslint',
    extends: ['prettier', 'eslint:recommended', 'plugin:import/errors', 'plugin:import/warnings'],
    plugins: ['prettier'],
    rules: {
        'require-atomic-updates': 'off',
        'no-unused-vars': 'warn'
    }
};
