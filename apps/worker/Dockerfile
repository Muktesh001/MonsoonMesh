FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/worker apps/worker
RUN npm run build -w apps/worker

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/worker/package.json ./apps/worker/package.json
COPY --from=build /workspace/apps/worker/dist ./apps/worker/dist
RUN addgroup -S app && adduser -S app -G app
USER app
CMD ["node", "apps/worker/dist/index.js"]
