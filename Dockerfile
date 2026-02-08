# Build server
FROM node:20-slim AS build
WORKDIR /app

COPY server/package.json server/package.json

RUN cd server && npm install

COPY server server

RUN cd server && npx prisma generate

# Runtime
FROM node:20-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/server /app/server
EXPOSE 3030

CMD ["sh", "-c", "cd /app/server && npx prisma migrate deploy && node index.js"]
