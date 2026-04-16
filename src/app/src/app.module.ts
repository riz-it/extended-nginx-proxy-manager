import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { LbModule } from './lb/lb.module';
import { AuthModule } from './auth/auth.module';

import { ScheduleModule } from '@nestjs/schedule';
import { TrafficModule } from './traffic/traffic.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule, 
    LbModule, 
    AuthModule,
    TrafficModule
  ],
  controllers: [AppController],
})
export class AppModule {}
