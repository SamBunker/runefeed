# ── Build stage ──
# Installs dependencies and compiles TypeScript → JavaScript
FROM node:20-alpine AS build

WORKDIR /build
COPY package*.json ./
RUN npm ci --quiet
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Run stage ──
# Slim image with only the compiled JS and production dependencies
FROM node:20-alpine

WORKDIR /app

# Copy compiled output and production dependencies
COPY --from=build /build/dist ./dist
COPY --from=build /build/node_modules ./node_modules
COPY package.json ./

# Config and data directories are mounted as volumes
# so they persist across container rebuilds
RUN mkdir -p /app/config /app/data

EXPOSE 3900

# Run the server directly (not via CLI — Docker is always "serve" mode)
CMD ["node", "dist/server/index.js"]
