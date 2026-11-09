# ---------- Giai đoạn 1: build ----------
FROM node:24-alpine AS build
WORKDIR /app

# Copy package.json trước để Docker cache lớp npm ci (chỉ cài lại khi đổi thư viện)
COPY package*.json ./
RUN npm ci

COPY . .
# Prisma 7 đọc DATABASE_URL từ file cấu hình; lúc build chỉ cần một giá trị giả
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate && npm run build && npm prune --omit=dev

# ---------- Giai đoạn 2: chạy ----------
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma*.config.ts ./

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
