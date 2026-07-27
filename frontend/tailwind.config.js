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
        // Accent ramps below are re-tuned for this LIGHT theme (white surfaces,
        // coffee-brown text). Any shade NOT listed here keeps Tailwind's stock
        // value, which is built for dark backgrounds and washes out to nothing
        // on white — that is exactly why `text-amber-200` was invisible. So
        // every shade the app uses for TEXT is pinned, not just 300/400/500.
        // Rule of thumb: 200/300 = text (dark enough for ≥4.5:1 on white),
        // 400/500 = fills, borders and low-opacity tints.
        emerald: {
          300: '#27AE60', // Success green for text
          400: '#2ECC71', // accent green
          500: '#27AE60', // status badges
        },
        rose: {
          200: '#A93226', // hover/darker error text
          300: '#E74C3C', // Error red for text
          400: '#E74C3C',
          500: '#C0392B',
        },
        amber: {
          // Was #E67E22 — only ~2.9:1 on white, which is what made warning
          // text hard to read. #B45309 clears AA at 5:1 and still reads as
          // the same warning orange on the pale amber tints it sits on.
          200: '#B45309',
          300: '#B45309', // Warning orange for text
          400: '#E67E22',
          500: '#D35400',
        },
        sky: {
          200: '#1F618D', // darker info blue for text
          300: '#3498DB', // Info blue for text
          400: '#3498DB',
          500: '#2980B9',
        },
        // Families the original palette never re-tuned, so their text shades
        // were still Tailwind's pale dark-theme defaults on a white page.
        red: {
          300: '#C0392B', // error text (used interchangeably with `rose`)
          400: '#C0392B',
          500: '#C0392B',
        },
        violet: {
          300: '#7D3C98', // complimentary/giveaway text
          400: '#8E44AD',
          500: '#8E44AD',
        },
        purple: {
          300: '#7D3C98', // Chef role badge
          500: '#8E44AD',
        },
        indigo: {
          300: '#3F51B5', // KOT counter badge
          500: '#3F51B5',
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
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'slide-in-right': 'slide-in-right 0.25s ease-out both',
      },
    },
  },
  plugins: [],
}
