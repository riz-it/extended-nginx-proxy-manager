import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public client: PrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL || 'file:/data/custom-lb.sqlite';
    this.logger.log(`Initializing Prisma with URL: ${url}`);

    try {
      // Create the Prisma adapter with libsql config
      const adapter = new PrismaLibSql({ url });

      // Initialize Prisma Client with the adapter
      this.client = new PrismaClient({
        adapter,
        log: ['error', 'warn'],
      });
    } catch (error) {
      this.logger.error('Critical failure during Prisma initialization');
      if (error instanceof Error) {
        this.logger.error(error.message);
      }
      throw error;
    }
  }

  // Helper getters to mimic the models
  get loadBalancer() {
    return this.client.loadBalancer;
  }

  get upstream() {
    return this.client.upstream;
  }

  async onModuleInit() {
    try {
      this.logger.log('Connecting to database...');
      await this.client.$connect();
      this.logger.log('Successfully connected to LibSQL database.');
    } catch (error) {
      this.logger.error('Failed to connect to LibSQL database');
      if (error instanceof Error) {
        this.logger.error(error.message);
      }
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.$disconnect();
    }
  }
}
