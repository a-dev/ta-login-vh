FROM oven/bun:1.4

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --chown=bun:bun . .

USER bun
EXPOSE 3005
CMD ["bun", "run", "start"]
