FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
ENV NODE_ENV=production
EXPOSE 4000
# Apply migrations, then start the API + in-process job worker.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
