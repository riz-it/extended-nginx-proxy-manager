import { Module } from '@nestjs/common';
import { TrafficService } from './traffic.service';
import { TrafficController } from './traffic.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [TrafficService],
  controllers: [TrafficController],
  exports: [TrafficService]
})
export class TrafficModule {}
