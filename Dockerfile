# Build client and server
FROM node:20-alpine AS build
WORKDIR /app

COPY server/package.json server/package.json
COPY client/package.json client/package.json

RUN cd server && npm install
RUN cd client && npm install

COPY server server
COPY client client

RUN cd server && npx prisma generate
RUN cd client && npm run build

# Runtime
FROM node:20-alpine
WORKDIR /app

COPY --from=build /app/server /app/server
COPY --from=build /app/client /app/client

EXPOSE 3030

CMD ["sh", "-c", "cd /app/server && npx prisma migrate deploy && node index.js"]
