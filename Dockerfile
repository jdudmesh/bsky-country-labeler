FROM oven/bun:latest

RUN mkdir -p src

COPY package.json ./
COPY bun.lock ./
COPY src ./src

RUN bun install

CMD ["bun", "src/main.ts"]