import type { ToolConfig } from '@itsjust/core';

const toolConfig = {
  id: 'random-number-generator',
  name: 'Random Number Generator',
  description:
    'Generate random numbers with flexible min/max range, count, uniqueness and decimal precision controls, with statistics, copy actions, history and shareable URL state.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: false,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#10b981',
    accentHover: '#059669',
    accentSubtle: 'rgba(16, 185, 129, 0.12)',
    brand: 'Random Number Generator',
    icon: '🎲',
  },
  shortcuts: [
    {
      title: 'Random Number Generator',
      shortcuts: [
        { keys: 'G', label: 'Generate', description: 'generate a new set of numbers' },
        { keys: 'M', label: 'Mode', description: 'toggle integer/decimal mode' },
        { keys: 'U', label: 'Unique', description: 'toggle unique-only mode' },
        { keys: 'Y', label: 'Copy all', description: 'copy all values to the clipboard' },
      ],
    },
  ],
} satisfies ToolConfig;

export default toolConfig;
