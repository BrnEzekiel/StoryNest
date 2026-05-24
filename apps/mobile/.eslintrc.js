module.exports = {
  extends: ['expo'],
  rules: {
    // Disable some problematic rules that might rely on broken plugins
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
  }
};
