# Qirata Express Backend

## Summary
This is the Express.js backend service for the Qirata platform. It provides RESTful APIs and WebSocket functionality for content management, real-time chat, and social media integration. This document provides comprehensive information about the project setup, development workflow, and deployment process.

Key sections:
- Quick start guide
- Development environment setup
- API documentation
- Database schema and migrations
- WebSocket functionality
- Deployment instructions

## Quick Start

1. Clone the repository
2. Run setup script:
```bash
chmod +x ./scripts/setup.sh
./scripts/setup.sh
```

3. Start development server:
```bash
npm run dev
```

## Development Setup

See [Setup Guide](./docs/SETUP.md) for detailed setup instructions.

## API Documentation

See [API Documentation](./docs/API.md) for detailed API endpoints and WebSocket events.

## Database Schema

### Links
```sql
CREATE TABLE links (
  id UUID PRIMARY KEY,
  url VARCHAR NOT NULL,
  title VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Posts
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  title VARCHAR NOT NULL,
  content TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Chat Sessions
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Social Posts
```sql
CREATE TABLE social_posts (
  id UUID PRIMARY KEY,
  content TEXT NOT NULL,
  platform VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Available Scripts

- `npm run dev`: Start development server with hot-reload
- `npm run build`: Build TypeScript code
- `npm start`: Start production server
- `npm test`: Run tests
- `npm run lint`: Lint code
- `npm run migration:run`: Run database migrations
- `npm run migration:create`: Create new migration
- `npm run migration:revert`: Revert last migration

## WebSocket Documentation

Real-time features are implemented using Socket.IO. See [API Documentation](./docs/API.md#websocket-events) for available events.

## Deployment Guide

### Production Setup

1. Build the application:
```bash
npm run build
```

2. Configure environment:
```bash
cp .env.example .env
# Update .env with production values
```

3. Run migrations:
```bash
npm run migration:run
```

### PM2 Configuration

Create ecosystem.config.js:
```javascript
module.exports = {
  apps: [{
    name: 'qirata-backend',
    script: 'dist/app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

Start with PM2:
```bash
pm2 start ecosystem.config.js
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}