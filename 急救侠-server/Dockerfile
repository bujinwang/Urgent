# ============================================================
# 急救侠 后端服务 — 多阶段构建
# ============================================================

# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# 安装构建依赖（better-sqlite3 需要 C++ 编译器）
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/

# TypeScript 编译
RUN npx tsc

# ---- Production stage ----
FROM node:22-alpine

WORKDIR /app

# 运行时依赖（仅安装生产依赖，跳过 devDependencies）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 复制编译产物
COPY --from=builder /app/dist/ dist/

# 数据目录（SQLite）
RUN mkdir -p data

EXPOSE 3001

# 通过 .env 或环境变量配置
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
