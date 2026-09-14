# The build context is the repo root, since server.js expects backend and frontend to sit side by side.
FROM node:22-alpine
WORKDIR /app

# Installing dependencies before copying the rest of the code lets Docker skip this step on rebuilds where package.json hasn't changed.
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend
EXPOSE 3001

# No --env-file here. Docker provides environment variables directly, so this flag (needed for local dev) is not required inside the container.
CMD ["node", "server.js"]
