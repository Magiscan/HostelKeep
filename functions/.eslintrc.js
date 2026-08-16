// NOTE: this file must itself satisfy the rules it defines, since `eslint .`
// lints the config too. Hence double quotes and no space inside braces.
module.exports = {
  root: true,
  env: {es2022: true, node: true},
  parserOptions: {ecmaVersion: 2022, sourceType: "script"},
  extends: ["eslint:recommended", "google"],
  rules: {
    "quotes": ["error", "double", {allowTemplateLiterals: true}],
    "object-curly-spacing": ["error", "never"],
    "max-len": ["warn", {code: 100}],
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
  },
};
