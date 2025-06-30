# Setup Guide

## Summary
This document provides comprehensive instructions for setting up and configuring the Qirata Express backend environment. Whether you're a new developer getting started with the project or deploying to production, this guide walks you through the entire process from prerequisites to troubleshooting common issues.

What you'll find in this guide:
- System requirements and prerequisites
- Step-by-step installation process
- Environment configuration details
- Database setup and migration instructions
- Development workflow guidelines
- Troubleshooting common setup issues
- Production deployment configuration

## Prerequisites

- Node.js >= 16.x
- PostgreSQL >= 14.x
- TypeScript >= 4.5.x
- Redis (for WebSocket support)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd express-backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Configure your `.env` file with appropriate values

## Environment Configuration

Update the `.env` file with your configuration:

```env
# Server
PORT=3000
NODE_ENV=development
API_VERSION=v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=qirata
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# WebSocket
WS_PORT=3001
REDIS_URL=redis://localhost:6379
```

## Database Setup

1. Create database:
```bash
createdb qirata
```

2. Run migrations:
```bash
npm run migration:run
```

3. (Optional) Seed initial data:
```bash
npm run seed
```

## Development Workflow

1. Start development server:
```bash
npm run dev
```

2. Run tests:
```bash
npm test
```

3. Lint code:
```bash
npm run lint
```

4. Create new migration:
```bash
npm run migration:create <migration-name>
```

## Troubleshooting

### Database Connection Issues

1. Verify PostgreSQL is running:
```bash
pg_isready
```

2. Check database credentials in `.env`

3. Ensure database exists:
```bash
psql -l | grep qirata
```

### WebSocket Connection Issues

1. Verify Redis is running:
```bash
redis-cli ping
```

2. Check WebSocket port is not in use:
```bash
lsof -i :3001
```

## Additional Resources

- [TypeORM Documentation](https://typeorm.io/)
- [Express.js Documentation](https://expressjs.com/)
- [Socket.IO Documentation](https://socket.io/docs/v4/)