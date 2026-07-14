FROM oven/bun:1.2-alpine

WORKDIR /app

# Install deps first for better layer caching
COPY package.json bun.lock* bunfig.toml* ./
RUN bun install --frozen-lockfile || bun install

# Copy the rest of the project
COPY . .

ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV PORT=8119

EXPOSE 8119

# Vite dev server bound to 0.0.0.0:8119.
# Supabase (database + auth + storage) is remote and configured via .env.
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8119"]
