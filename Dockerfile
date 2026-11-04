FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node server/src ./src
COPY --chown=node:node server/scripts ./scripts
COPY --chown=node:node server/db ./db
COPY --chown=node:node web-ban-quan-ao/index.html web-ban-quan-ao/checkout.html web-ban-quan-ao/account.html web-ban-quan-ao/login.html web-ban-quan-ao/register.html /app/frontend/
COPY --chown=node:node web-ban-quan-ao/css /app/frontend/css
COPY --chown=node:node web-ban-quan-ao/js /app/frontend/js
COPY --chown=node:node img /app/img
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
