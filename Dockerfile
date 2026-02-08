# Build server
FROM node:20-alpine AS build
WORKDIR /app

COPY server/package.json server/package.json

RUN cd server && npm install

COPY server server

RUN cd server && npx prisma generate

# Runtime
FROM node:20-alpine
WORKDIR /app

COPY --from=build /app/server /app/server
EXPOSE 3030

CMD ["sh", "-c", "cd /app/server && npx prisma migrate deploy && node index.js"]
