# Stage 1: Builder
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm run prisma:generate && npm run build

# Stage 2: Runner
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
