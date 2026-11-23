# Random Number Generator

Generate random numbers with a flexible range, count, uniqueness and precision controls. A practical utility for sampling, drafting, games and statistics.

**Live:** [random-number-generator.itsjust.tools](https://random-number-generator.itsjust.tools)

## Features

- Min/max range inputs with instant generation (`G`)
- Generate 1–1000 numbers at once
- Unique-only mode preventing duplicate draws (partial Fisher-Yates over the candidate pool)
- Integer or decimal output with configurable decimal places (0–10)
- Sum, average, min and max statistics of the generated set
- Copy the first value or copy all values comma/space/newline separated
- Generation history with timestamps and one-click re-run of previous settings
- Shareable state via URL hash, `.itsjust.json` import/export and image/PDF export
- 100% client-side — no data ever leaves your browser

## Keyboard shortcuts

| Key | Action                      |
| --- | --------------------------- |
| `G` | Generate a new set          |
| `M` | Toggle integer/decimal mode |
| `U` | Toggle unique-only mode     |
| `Y` | Copy all values             |

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t random-number-generator .
docker run -p 3000:3000 random-number-generator
```

## License

MIT
