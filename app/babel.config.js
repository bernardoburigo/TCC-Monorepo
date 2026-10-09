module.exports = function (api) {
  api.cache(true);
  return {
    // NativeWind 4: o JSX passa por nativewind (className -> estilo) e o preset
    // `nativewind/babel` liga o interop de CSS.
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
