/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B0B0D',
          soft: '#101014',
          card: '#16161B',
          line: '#26262E',
        },
        gold: {
          DEFAULT: '#C9A227',
          soft: '#E0C463',
          deep: '#8C6F1A',
        },
        cream: {
          DEFAULT: '#F5EFE0',
          dim: '#B9B3A4',
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(201,162,39,0.35), 0 10px 40px -12px rgba(201,162,39,0.35)',
        lift: '0 20px 50px -20px rgba(0,0,0,0.8)',
      },
      backgroundImage: {
        'gold-grad': 'linear-gradient(135deg, #E0C463 0%, #C9A227 45%, #8C6F1A 100%)',
        'ink-grad': 'radial-gradient(1200px 600px at 80% -10%, rgba(201,162,39,0.10), transparent 60%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
}
