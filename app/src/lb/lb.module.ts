import { Module } from '@nestjs/common';
import { LbController } from './lb.controller';
import { LbService } from './lb.service';
import { NginxModule } from '../nginx/nginx.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [NginxModule, AuthModule],
  controllers: [LbController],
  providers: [LbService],
})
export class LbModule {}
