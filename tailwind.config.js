/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#FFFFFF',       // White main background
          soft: '#FFFFFF',          // White sidebar background
          card: '#FFFFFF',          // White cards
          line: '#E8DCC4',          // Soft beige borders
        },
        gold: {
          DEFAULT: '#C9A961',       // Muted gold accents
          soft: '#B8935A',          // Gold Hover
          deep: '#A67C52',          // Gold Active
        },
        cream: {
          DEFAULT: '#3E2723',       // Coffee brown main text
          dim: '#5D4037',           // Chocolate secondary text
        },
        emerald: {
          300: '#27AE60', // Success green for text
          400: '#2ECC71', // accent green
          500: '#27AE60', // status badges
        },
        rose: {
          300: '#E74C3C', // Error red for text
          400: '#E74C3C',
          500: '#C0392B',
        },
        amber: {
          300: '#E67E22', // Warning orange for text
          400: '#E67E22',
          500: '#D35400',
        },
        sky: {
          300: '#3498DB', // Info blue for text
          400: '#3498DB',
          500: '#2980B9',
        },
      },
      fontFamily: {
        serif: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(201,169,97,0.15), 0 10px 40px -12px rgba(201,169,97,0.2)',
        lift: '0 20px 50px -20px rgba(62,39,35,0.08)',
      },
      backgroundImage: {
        'gold-grad': 'linear-gradient(135deg, #C9A961 0%, #B8935A 50%, #A67C52 100%)',
        'ink-grad': 'radial-gradient(1200px 600px at 80% -10%, rgba(201,169,97,0.04), transparent 60%)',
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
