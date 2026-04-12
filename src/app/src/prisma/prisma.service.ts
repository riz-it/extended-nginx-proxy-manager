import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public client: PrismaClient;

  constructor() {
    this.client = new PrismaClient({
      log: ['error', 'warn'],
    });
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
      this.logger.log('Successfully connected to database.');
    } catch (error) {
      this.logger.error('Failed to connect to database');
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
