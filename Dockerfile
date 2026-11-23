# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# Prefer clean lock install; fall back if lock drifts in older checkouts
RUN npm ci --omit=dev || npm install --omit=dev

COPY public ./public
COPY src ./src
COPY tailwind.config.js postcss.config.js ./

# CRA needs these for a production build
ENV CI=true
ENV GENERATE_SOURCEMAP=false
# Avoid OOM on small VPS builds
ENV NODE_OPTIONS=--max-old-space-size=2048

RUN npm run build

# Runtime stage — static files via nginx
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
