import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // Global API prefix
  app.setGlobalPrefix('api');

  // CORS for development
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // Serve static frontend files (after API routes are registered)
  const publicDir = join(__dirname, '..', 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));

    // SPA fallback: serve index.html for all non-API GET requests
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        const indexPath = join(publicDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          return res.sendFile(indexPath);
        }
      }
      next();
    });
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  logger.log(`🚀 Custom LB Manager API running on port ${port}`);
  logger.log(`📡 API: http://localhost:${port}/api`);
  logger.log(`🖥️  UI:  http://localhost:${port}`);
}
bootstrap();
