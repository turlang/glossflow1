# Imagem de produção da API GlossFlow.
# Mantém o deploy reproduzível: instala dependências, gera Prisma Client,
# compila TypeScript e executa apenas o backend compilado.
FROM node:20-alpine AS api

WORKDIR /app/backend

# Copiamos package.json/package-lock primeiro para aproveitar cache do Docker.
COPY backend/package*.json ./
RUN npm ci

# Copia o backend completo depois das dependências.
COPY backend/ ./

# Prisma Client precisa ser gerado antes do build.
RUN npm run prisma:generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3333

CMD ["npm", "run", "render:start"]
