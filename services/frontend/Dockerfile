FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i -E 's#http://localhost:30[0-9]{2}##g' {} +
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
