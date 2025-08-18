# Content Service - Development Guide

## Quick Start

### For Local Development

```bash
# Install dependencies
npm install

# Run the service in development mode (with TypeScript path resolution)
npm run dev

# Alternative: Use the local runner script
node run_local.js
```

### For Production

```bash
# Build the TypeScript source
npm run build

# Start the production server
npm start
```

## TypeScript Path Mapping

This service uses TypeScript path mapping for cleaner imports. The configuration is split between development and production:

### Development Mode
- Uses `ts-node` with `tsconfig-paths/register` to resolve `@/*` imports
- Configured in `tsconfig.json` under `paths`
- Run with: `npm run dev`

### Production Mode
- Uses compiled JavaScript with `module-alias` for path resolution
- Configured in `package.json` under `_moduleAliases`
- Build first: `npm run build`, then run: `npm start`

## Path Mappings

| Alias | Resolves to |
|-------|-------------|
| `@/*` | `src/*` |
| `@models/*` | `src/models/*` |
| `@services/*` | `src/services/*` |
| `@middleware/*` | `src/middleware/*` |
| `@utils/*` | `src/utils/*` |
| `@config/*` | `src/config/*` |
| `@types/*` | `src/types/*` |

## Common Issues

### "Cannot find module '@/config/database'" Error

This error occurs when TypeScript path mapping is not properly configured. Solutions:

1. **For Development**: Ensure you're using `npm run dev` (not `node src/server.ts` directly)
2. **For Production**: Ensure you've run `npm run build` first
3. **IDE Issues**: Restart your TypeScript language server

### Missing Dependencies

If you see module resolution errors:

```bash
npm install
```

### Environment Variables

Copy the `.env.example` to `.env` and configure for your environment:

```bash
cp .env.example .env
```

## Database Setup

The Content service requires:
- MongoDB for content storage
- Redis for caching
- Elasticsearch for search functionality

### Using Docker Compose (Recommended)

```bash
# From the project root
docker-compose up -d postgres redis elasticsearch minio
```

### Manual Setup

1. **MongoDB**: Install and run MongoDB locally
2. **Redis**: Install and run Redis locally  
3. **Elasticsearch**: Install and run Elasticsearch locally

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm test` | Run unit tests |
| `npm run test:integration` | Run integration tests |
| `npm run lint` | Run ESLint |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed the database with test data |

## Troubleshooting

### Port Already in Use

If port 8082 is already in use, set the PORT environment variable:

```bash
PORT=8083 npm run dev
```

### TypeScript Compilation Issues

Clear the TypeScript build cache:

```bash
rm -rf dist/
npm run build
```

### Module Resolution in Tests

For Jest tests, ensure `jest.config.js` includes module name mapping:

```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@models/(.*)$': '<rootDir>/src/models/$1',
  // ... other mappings
}
```
