/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Enhanced zinc-based palette for glassmorphic design
        zinc: {
          750: '#3f3f46',
          850: '#27272a',
          925: '#18181b',
          975: '#09090b',
        },
        // Video Editor Color System - Enhanced glassmorphic palette
        editor: {
          // Background colors with glassmorphic support
          bg: {
            primary: '#09090b',        // zinc-950 - main background
            secondary: '#18181b',      // zinc-900 - secondary panels
            tertiary: '#27272a',       // zinc-800 - elevated elements
            glass: {
              primary: 'rgba(39, 39, 42, 0.35)',    // zinc-800/35 - main glass
              secondary: 'rgba(39, 39, 42, 0.25)',   // zinc-800/25 - lighter glass
              tertiary: 'rgba(63, 63, 70, 0.20)',    // zinc-700/20 - subtle glass
              overlay: 'rgba(0, 0, 0, 0.60)',        // backdrop overlay
            },
            panel: '#18181b',          // zinc-900 - panel backgrounds
            canvas: '#09090b',         // zinc-950 - canvas/timeline
          },
          // Text colors
          text: {
            primary: 'rgba(255, 255, 255, 0.90)',   // white/90 - primary text
            secondary: 'rgba(255, 255, 255, 0.80)', // white/80 - secondary text
            tertiary: 'rgba(255, 255, 255, 0.50)',  // white/50 - tertiary text
            muted: 'rgba(255, 255, 255, 0.40)',     // white/40 - muted text
          },
          // Border colors for glassmorphic effects
          border: {
            primary: 'rgba(255, 255, 255, 0.20)',   // white/20 - primary borders
            secondary: 'rgba(255, 255, 255, 0.15)', // white/15 - secondary borders
            tertiary: 'rgba(255, 255, 255, 0.10)',  // white/10 - subtle borders
            accent: 'rgba(255, 255, 255, 0.30)',    // white/30 - accent borders
          },
          // Interactive states with glassmorphic effects
          interactive: {
            hover: 'rgba(255, 255, 255, 0.10)',     // white/10 - hover overlay
            active: 'rgba(255, 255, 255, 0.20)',    // white/20 - active state
            disabled: 'rgba(255, 255, 255, 0.05)',  // white/5 - disabled state
          },
          // Status colors
          status: {
            success: '#10b981',    // emerald-500
            warning: '#f59e0b',    // amber-500
            error: '#ef4444',      // red-500
            info: '#3b82f6',       // blue-500
          },
          // Enhanced timeline colors
          timeline: {
            waveform: '#71717a',   // zinc-500
            cut: {
              accepted: 'rgba(239, 68, 68, 0.35)',   // red-500 with opacity
              preview: 'rgba(245, 158, 11, 0.35)',   // amber-500 with opacity
              selection: 'rgba(59, 130, 246, 0.3)',  // blue-500 with opacity
            },
            indicator: {
              current: '#00ff00',   // green for current time
              scrub: '#ff6b35',     // orange for scrubbing
            },
            ruler: {
              background: 'rgba(64, 64, 64, 0.2)',
              hover: 'rgba(100, 150, 255, 0.1)',
              border: 'rgba(100, 100, 100, 0.3)',
              hoverBorder: 'rgba(100, 150, 255, 0.5)',
            }
          }
        }
      }
    },
  },
  plugins: [],
}

