FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY database/migrations ./database/migrations
RUN addgroup -S app && adduser -S app -G app && mkdir -p uploads && chown -R app:app /workspace
USER app
EXPOSE 4000
CMD ["node", "apps/api/dist/src/index.js"]
