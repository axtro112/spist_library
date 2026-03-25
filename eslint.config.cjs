module.exports = [
  {
    files: ["server.js", "src/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
    },
    rules: {
      "no-unreachable": "error",
      "valid-typeof": "error",
      "no-constant-binary-expression": "error",
    },
  },
];
