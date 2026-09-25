# /apps/api/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile --filter @apkrunner/api...
RUN pnpm --filter @apkrunner/database prisma generate || true
RUN pnpm --filter @apkrunner/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install --prod --frozen-lockfile --filter @apkrunner/api...

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY packages/database/prisma ./packages/database/prisma

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
