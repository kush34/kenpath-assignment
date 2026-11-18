FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY client ./client
COPY server ./server
RUN chown -R node:node /app
USER node
EXPOSE 4000 5173
CMD ["npm", "start"]
