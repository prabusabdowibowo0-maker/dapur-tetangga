// Konfigurasi Tailwind (CDN). Token warna dari mockup Dapur Tetangga.
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: '#a63311', 'primary-container': '#c84b28', 'on-primary': '#ffffff', 'primary-fixed': '#ffdbd1',
        secondary: '#1c6c3f', 'secondary-fixed': '#a5f4bb', 'on-secondary': '#ffffff', 'on-secondary-fixed-variant': '#00522b',
        tertiary: '#815100', 'tertiary-fixed': '#ffddb8', 'on-tertiary-fixed': '#2a1700',
        surface: '#fbf9f6', 'surface-lowest': '#ffffff', 'surface-low': '#f5f3f0', 'surface-high': '#eae8e5', 'surface-highest': '#e4e2df',
        'on-surface': '#1b1c1a', 'on-surface-variant': '#58413b', 'inverse-surface': '#30312f', 'inverse-on-surface': '#f2f0ed',
        error: '#ba1a1a', 'on-error': '#ffffff', 'error-container': '#ffdad6', 'on-error-container': '#93000a',
      },
      fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'] },
    },
  },
};
