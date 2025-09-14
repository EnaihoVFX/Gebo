/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Video Editor Color System - Consistent slate-based palette
        slate: {
          750: '#1e293b',
          850: '#0f172a',
        },
        // Video Editor specific colors for consistent theming
        editor: {
          // Background colors
          bg: {
            primary: '#0f172a',    // slate-900
            secondary: '#1e293b',  // slate-800
            tertiary: '#334155',   // slate-700
            panel: '#1e293b',      // slate-800
            canvas: '#0a0a0a',     // near-black for canvas
          },
          // Text colors
          text: {
            primary: '#f1f5f9',    // slate-100
            secondary: '#cbd5e1',  // slate-300
            tertiary: '#94a3b8',   // slate-400
            muted: '#64748b',      // slate-500
          },
          // Border colors
          border: {
            primary: '#475569',    // slate-600
            secondary: '#334155',  // slate-700
            accent: '#1e293b',     // slate-800
          },
          // Interactive states
          interactive: {
            hover: '#334155',      // slate-700
            active: '#475569',     // slate-600
            disabled: '#475569',   // slate-600
          },
          // Status colors
          status: {
            success: '#10b981',    // emerald-500
            warning: '#f59e0b',    // amber-500
            error: '#ef4444',      // red-500
            info: '#3b82f6',       // blue-500
          },
          // Timeline specific colors
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

