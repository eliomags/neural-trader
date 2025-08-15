FROM node:18-alpine

WORKDIR /app

# Install Python and build dependencies for TensorFlow
RUN apk add --no-cache python3 py3-pip make g++ 

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Build TypeScript
RUN npm run build

# Create directories
RUN mkdir -p logs data models config

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Start application
CMD ["node", "dist/index.js"]