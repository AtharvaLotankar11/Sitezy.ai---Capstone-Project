# Stage 1: Build the frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Production image
FROM node:22-alpine
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV PORT=5000

# Setup backend package files and install dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production

# Copy backend source
COPY backend/ ./

# Create uploads directory (needed by the backend static serving logic)
RUN mkdir -p /app/backend/uploads

# Copy the built frontend from Stage 1 into the designated dist path
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose backend port
EXPOSE 5000

# Start server
CMD ["npm", "start"]
