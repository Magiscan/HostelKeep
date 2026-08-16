module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Strip console.* in production builds
      process.env.NODE_ENV === 'production' ? 'transform-remove-console' : null,
    ].filter(Boolean),
  };
};