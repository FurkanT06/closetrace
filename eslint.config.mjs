import coreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...coreWebVitals,
  {
    rules: {
      // Mount-time effects here read browser storage and then set state. They work, and moving
      // them to useSyncExternalStore is a separate refactor, so they stay visible as warnings.
      'react-hooks/set-state-in-effect': 'warn',
      // The app is a single hash-routed page; plain links back to "/" are intentional reloads.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  // Generated output, the starter's vendored tooling, and generated shadcn components are skipped.
  { ignores: ['dist/**', '.next/**', '.wrangler/**', 'scripts/**', 'components/ui/**'] },
];

export default config;
