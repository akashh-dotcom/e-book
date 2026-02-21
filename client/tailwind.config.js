/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Source Serif 4', 'serif'],
        sans: ['Inter', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        forest: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#020a06',
        },
        candy: {
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          accent: '#ff6b6b',
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 10s ease-in-out infinite',
        'float-fast': 'float 4s ease-in-out infinite',
        'bounce-in': 'bounceIn 0.8s ease-out both',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'wiggle-slow': 'wiggle 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'gradient-shift': 'gradientShift 4s ease-in-out infinite',
        'wave': 'wave 1.2s ease-in-out infinite',
        'sparkle': 'sparkle 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.6s ease-out both',
        'pop': 'pop 0.4s cubic-bezier(0.68,-0.55,0.265,1.55) both',
        'glow-ring': 'glowRing 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '25%': { transform: 'translateY(-12px) rotate(3deg)' },
          '75%': { transform: 'translateY(8px) rotate(-2deg)' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3) rotate(-5deg)', opacity: '0' },
          '50%': { transform: 'scale(1.08) rotate(2deg)', opacity: '1' },
          '70%': { transform: 'scale(0.95) rotate(-1deg)' },
          '100%': { transform: 'scale(1) rotate(0)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-3deg)' },
          '75%': { transform: 'rotate(3deg)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(16,185,129,0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(16,185,129,0.4), 0 0 60px rgba(16,185,129,0.1)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        sparkle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.3)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        glowRing: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(16,185,129,0)' },
        },
      },
    },
  },
  plugins: [],
};
