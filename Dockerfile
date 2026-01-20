# EVA - Explore, Validate, Analyze
# Docker image for CI/CD and air-gapped environments
#
# Usage:
#   docker build -t eva-qa .
#   docker run --rm eva-qa http://host.docker.internal:3000
#
# With authentication:
#   docker run --rm -v $(pwd)/auth.json:/app/auth.json eva-qa http://host.docker.internal:3000 --auth /app/auth.json
#
# With environment variables:
#   docker run --rm -e SUPABASE_URL=... -e SUPABASE_SERVICE_KEY=... eva-qa http://host.docker.internal:3000

FROM node:20-slim

# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Playwright browsers
RUN npx playwright install chromium

# Copy built files
COPY dist/ ./dist/
COPY README.md LICENSE ./

# Create output directory
RUN mkdir -p /app/eva-qa-reports

# Set default output directory
ENV EVA_OUTPUT_DIR=/app/eva-qa-reports

# Default command
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]
