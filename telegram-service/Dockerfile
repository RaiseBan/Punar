FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN npm prune --production

EXPOSE 3003

CMD ["node", "dist/app.js"]
