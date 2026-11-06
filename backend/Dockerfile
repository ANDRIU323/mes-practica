FROM node:22-alpine AS base
# Prisma necesita OpenSSL para su motor de consultas
RUN apk add --no-cache openssl
WORKDIR /app

# ---------- Build: dependencias completas, Prisma Client y compilación TS ----------
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# Quita las devDependencies; el cliente generado en node_modules/.prisma se conserva
RUN npm prune --omit=dev

# ---------- Imagen final: solo dist y dependencias de producción ----------
FROM base
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/server.js"]
