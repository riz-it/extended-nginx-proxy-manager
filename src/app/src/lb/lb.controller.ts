import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { LbService } from './lb.service';
import { CreateLbDto } from './dto/create-lb.dto';
import { UpdateLbDto } from './dto/update-lb.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('lb')
@UseGuards(AuthGuard)
export class LbController {
  constructor(private readonly lbService: LbService) {}

  /**
   * GET /api/lb — list all load balancers
   */
  @Get()
  findAll() {
    return this.lbService.findAll();
  }

  /**
   * GET /api/lb/:id — get single load balancer
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lbService.findOne(id);
  }

  /**
   * POST /api/lb — create new load balancer
   */
  @Post()
  create(@Body() dto: CreateLbDto) {
    return this.lbService.create(dto);
  }

  /**
   * PUT /api/lb/:id — update load balancer
   */
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLbDto) {
    return this.lbService.update(id, dto);
  }

  /**
   * DELETE /api/lb/:id — delete load balancer
   */
  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.lbService.remove(id);
  }

  /**
   * GET /api/lb/:id/preview — preview nginx config
   */
  @Get(':id/preview')
  preview(@Param('id', ParseIntPipe) id: number) {
    return this.lbService.preview(id);
  }

  /**
   * PATCH /api/lb/:id/toggle — toggle active/inactive
   */
  @Patch(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.lbService.toggleStatus(id);
  }
}
