import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { LbModule } from './lb/lb.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [DatabaseModule, LbModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
