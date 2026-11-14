FROM node:24-alpine
WORKDIR /app
# Use npm ci e package-lock.json depois de estabilizar as dependências.
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm run prisma:generate && npm run build
EXPOSE 3001
CMD ["npm", "run", "start:prod"]
