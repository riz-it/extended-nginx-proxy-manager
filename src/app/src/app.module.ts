import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { LbModule } from './lb/lb.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, LbModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
