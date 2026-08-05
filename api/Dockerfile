FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY scripts ./scripts

# Uploads land on a mounted volume, owned by the unprivileged node user.
RUN mkdir -p /data/media && chown -R node:node /data/media
USER node

ENV PORT=8110 MEDIA_ROOT=/data/media
EXPOSE 8110
# 127.0.0.1, not localhost: localhost resolves to ::1 first inside the
# container and the server binds IPv4 only, so the probe would always fail.
HEALTHCHECK --interval=30s --timeout=4s --start-period=8s \
  CMD wget -qO- http://127.0.0.1:8110/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "src/server.js"]
