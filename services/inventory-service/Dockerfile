FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3003

# NOTE: dev-mode CMD, see vendor-service/Dockerfile for the production note.
CMD ["npm", "run", "dev"]