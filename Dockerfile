# Multi-stage Docker build for Hachi Tech POS
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --production

# Copy backend source
COPY backend/ /app/backend/
COPY schema.sql /app/schema.sql

# Copy built frontend assets to /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 5000

CMD ["node", "server.js"]
