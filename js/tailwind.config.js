// Palet "terracotta + sage + canvas" mengikuti desain referensi Dapur Tetangga.
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: '#B04B25', 'primary-container': '#C85A32', 'on-primary': '#ffffff', 'primary-fixed': '#FBF0EB',
        secondary: '#3E6B52', 'secondary-fixed': '#E7EFEA', 'on-secondary': '#ffffff', 'on-secondary-fixed-variant': '#284736',
        tertiary: '#92400E', 'tertiary-fixed': '#FEF3C7', 'on-tertiary-fixed': '#78350F',
        surface: '#FAF7F2', 'surface-lowest': '#ffffff', 'surface-low': '#F6F1E8', 'surface-high': '#EFE7DA', 'surface-highest': '#E8DFD1',
        'on-surface': '#1C1917', 'on-surface-variant': '#78716C', 'inverse-surface': '#1C1917', 'inverse-on-surface': '#F5F5F4',
        error: '#BA1A1A', 'on-error': '#ffffff', 'error-container': '#FEE2E2', 'on-error-container': '#991B1B',
        ink: '#1C1917', line: '#E8DFD1',
      },
      fontFamily: { heading: ['Outfit', 'sans-serif'], sans: ['Plus Jakarta Sans', 'sans-serif'] },
    },
  },
};
