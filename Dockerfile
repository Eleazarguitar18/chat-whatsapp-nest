# --- ETAPA 1: Compilación ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluyendo las de desarrollo para compilar)
RUN npm install

# Copiar el resto del código del proyecto
COPY . .

# Compilar el proyecto NestJS (genera la carpeta /dist)
RUN npm run build

# --- ETAPA 2: Producción ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copiar solo el package.json y los archivos necesarios
COPY package*.json ./

# Instalar ÚNICAMENTE dependencias de producción (ahorra cientos de MB)
# Usamos --legacy-peer-deps para evitar el conflicto de jimp con Baileys v7
RUN npm jid --omit=dev --legacy-peer-deps

# Copiar la app compilada desde la etapa anterior
COPY --from=builder /app/dist ./dist

# Exponer el puerto por defecto de NestJS
EXPOSE 3000

# Comando para arrancar la aplicación
CMD ["node", "dist/main.js"]