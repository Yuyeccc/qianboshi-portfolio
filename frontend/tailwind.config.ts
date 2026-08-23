import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        surfaceRaised: 'var(--color-surface-raised)',
        surfaceSubtle: 'var(--color-surface-subtle)',
        surfaceBrand: 'var(--color-surface-brand)',
        line: 'var(--color-border)',
        borderStrong: 'var(--color-border-strong)',
        heading: 'var(--color-heading)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        brand: 'var(--color-brand)',
        brandStrong: 'var(--color-brand-strong)',
        'market-positive': 'var(--color-market-positive)',
        'market-negative': 'var(--color-market-negative)',
        warning: 'var(--color-warning)',
        info: 'var(--color-info)',
        'data-flow': 'var(--color-data-flow)',
        model: 'var(--color-model)',
        llm: 'var(--color-llm)',
        scheduled: 'var(--color-scheduled)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'PingFang SC',
          'Microsoft YaHei',
          'Noto Sans CJK SC',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        panel: '6px',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        card: 'var(--shadow-card)',
        cardHover: 'var(--shadow-card-hover)',
      },
    },
  },
  plugins: [],
}

export default config