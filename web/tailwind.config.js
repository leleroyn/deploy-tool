/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#1677FF',
          light: '#4096FF',
          dark: '#0958D9',
          cyan: '#06B6D4',
        },
        // 深蓝侧边栏
        sidebar: {
          bg: '#001529',
          active: '#1677FF',
          hover: '#0d2137',
          text: '#8BA3BC',
          'text-active': '#FFFFFF',
        },
        // 蓝色顶栏
        topbar: {
          bg: '#1677FF',
          text: '#FFFFFF',
          'text-muted': 'rgba(255,255,255,0.7)',
        },
        bg: {
          DEFAULT: '#F0F2F5',
          secondary: '#FFFFFF',
          tertiary: '#F5F7FA',
        },
        text: {
          primary: '#1D2129',
          secondary: '#86909C',
          muted: '#4E5969',
        },
        status: {
          success: '#00B42A',
          error: '#F53F3F',
          warning: '#FF7D00',
          info: '#1677FF',
        },
        border: {
          DEFAULT: '#E5E6EB',
          light: '#F2F3F5',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
