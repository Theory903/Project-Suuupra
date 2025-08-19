# Content Delivery Service - Simple Node.js Implementation
FROM node:20-alpine AS base

# Development stage
FROM base AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8084
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production

# Production stage
FROM base AS production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./
EXPOSE 8084
CMD ["node", "server.js"]
