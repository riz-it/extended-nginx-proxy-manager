# ============================================================
# NPM Custom Load Balancer
# Base: Nginx Proxy Manager + NestJS API + React UI
# ============================================================

FROM jc21/nginx-proxy-manager:latest

# ---- Build Backend ----
WORKDIR /custom-app

# Set environment to development to ensure devDependencies are installed
ENV NODE_ENV=development

# Default DATABASE_URL for libsql/prisma (overridden by docker-compose env)
ENV DATABASE_URL=file:/data/custom-lb.sqlite

COPY app/package.json app/package-lock.json ./
RUN npm install

COPY app/ ./
RUN npx prisma generate
RUN npx nest build

# ---- Build Frontend ----
WORKDIR /custom-frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ---- Final Setup ----
WORKDIR /custom-app

# Move built frontend to be served by the backend
RUN mkdir -p /custom-app/public && \
    cp -r /custom-frontend/dist/* /custom-app/public/ && \
    rm -rf /custom-frontend

# ---- S6-Overlay Service Integration ----
# Create service directory
RUN mkdir -p /etc/s6-overlay/s6-rc.d/custom-api

# Create service type (longrun = background daemon)
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/custom-api/type

# Create service run script
RUN echo "#!/command/with-contenv bash" > /etc/s6-overlay/s6-rc.d/custom-api/run && \
    echo "cd /custom-app" >> /etc/s6-overlay/s6-rc.d/custom-api/run && \
    echo "for f in /run/s6/container_environment/*; do export \"\$(basename \"\$f\")\"=\"\$(cat \"\$f\")\"; done" >> /etc/s6-overlay/s6-rc.d/custom-api/run && \
    echo "npx prisma migrate deploy" >> /etc/s6-overlay/s6-rc.d/custom-api/run && \
    echo "exec node dist/main.js" >> /etc/s6-overlay/s6-rc.d/custom-api/run && \
    chmod +x /etc/s6-overlay/s6-rc.d/custom-api/run

# Register service in the 'user' bundle
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/custom-api

# Cleanup
RUN rm -rf /scripts/start.sh

# Ensure custom nginx config directory exists
RUN mkdir -p /data/nginx/custom

EXPOSE 80 81 443 3000

# We use the default ENTRYPOINT/CMD from the base image (/init)
