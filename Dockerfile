FROM node:20-slim AS builder
WORKDIR /app
COPY backend/node/package*.json ./backend/node/
RUN cd backend/node && npm install
COPY backend/node/ ./backend/node/
RUN cd backend/node && npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/backend/node/package*.json ./
RUN npm install --only=production
COPY --from=builder /app/backend/node/dist ./dist
COPY --from=builder /app/backend/node/public ./public
ENV PORT=4000
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/server.js"]
