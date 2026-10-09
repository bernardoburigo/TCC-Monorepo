/** @type {import('tailwindcss').Config} */
module.exports = {
  // O app é só claro (userInterfaceStyle: light) e não usa variantes `dark:`. Mas com o modo
  // padrão ('media') o runtime web do react-native-css-interop lança "Cannot manually set
  // color scheme, as dark mode is type 'media'" ao iniciar; 'class' evita o erro.
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
