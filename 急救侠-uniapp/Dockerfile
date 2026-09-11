# ============================================================
# 急救侠 前端 H5 — 多阶段构建
# ============================================================

# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# uni-app 编译通常不需要原生工具链；保留 python3/make/g++ 以备个别原生依赖
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# H5 构建，产物默认输出到 dist/build/h5
RUN npm run build:h5

# ---- Runtime stage ----
FROM nginx:alpine

# SPA 静态资源
COPY --from=builder /app/dist/build/h5 /usr/share/nginx/html

# 反代 /api 与 /uploads 到后端（服务名 server:3001，见 docker-compose.yml）
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
