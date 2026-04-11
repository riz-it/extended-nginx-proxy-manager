import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NginxService } from '../nginx/nginx.service';
import { CreateLbDto } from './dto/create-lb.dto';
import { UpdateLbDto } from './dto/update-lb.dto';

@Injectable()
export class LbService {
  private readonly logger = new Logger(LbService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nginx: NginxService,
  ) {}

  /**
   * List all load balancers with upstream counts
   */
  async findAll() {
    return this.prisma.loadBalancer.findMany({
      include: {
        upstreams: {
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single load balancer by ID
   */
  async findOne(id: number) {
    const lb = await this.prisma.loadBalancer.findUnique({
      where: { id },
      include: {
        upstreams: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!lb) {
      throw new NotFoundException(`LoadBalancer #${id} not found`);
    }

    return lb;
  }

  /**
   * Create a new load balancer and generate nginx config
   */
  async create(dto: CreateLbDto) {
    if (!dto.name || !dto.upstreams || dto.upstreams.length === 0) {
      throw new BadRequestException('name and at least 1 upstream required');
    }

    // Sanitize name (only alphanumeric + hyphens)
    const safeName = dto.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    const lb = await this.prisma.loadBalancer.create({
      data: {
        name: safeName,
        listenPort: dto.listenPort || 80,
        status: dto.status || 'active',
        algorithm: dto.algorithm || 'roundrobin',
        enableFailover: dto.enableFailover ?? true,
        enableLoadBalancing: dto.enableLoadBalancing ?? true,
        upstreams: {
          create: dto.upstreams.map((u) => ({
            host: u.host,
            weight: u.weight ?? 1,
            maxFails: u.maxFails ?? 3,
            failTimeout: u.failTimeout ?? '10s',
            isBackup: u.isBackup ?? false,
            protocol: u.protocol ?? 'http',
          })),
        },
      },
      include: { upstreams: true },
    });

    // Generate and apply nginx config ONLY if active
    if (lb.status === 'active') {
      try {
        await this.applyConfig(lb);
      } catch (error) {
        // Rollback if nginx config fails
        this.logger.error('Failed to apply nginx config, rolling back...', error);
        await this.prisma.loadBalancer.delete({ where: { id: lb.id } });
        throw new BadRequestException(`Nginx config validation failed: ${error}`);
      }
    }

    return lb;
  }

  /**
   * Update a load balancer (replace upstreams)
   */
  async update(id: number, dto: UpdateLbDto) {
    const existing = await this.findOne(id);

    // Update basic fields
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      updateData['name'] = dto.name
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
    }
    if (dto.listenPort !== undefined) {
      updateData['listenPort'] = dto.listenPort;
    }
    if (dto.status !== undefined) {
      updateData['status'] = dto.status;
    }
    if (dto.algorithm !== undefined) {
      updateData['algorithm'] = dto.algorithm;
    }
    if (dto.enableFailover !== undefined) {
      updateData['enableFailover'] = dto.enableFailover;
    }
    if (dto.enableLoadBalancing !== undefined) {
      updateData['enableLoadBalancing'] = dto.enableLoadBalancing;
    }

    // If upstreams provided, replace all
    if (dto.upstreams && dto.upstreams.length > 0) {
      // Delete old upstreams
      await this.prisma.upstream.deleteMany({
        where: { loadBalancerId: id },
      });

      // Create new ones
      await this.prisma.upstream.createMany({
        data: dto.upstreams.map((u) => ({
          host: u.host!,
          weight: u.weight ?? 1,
          maxFails: u.maxFails ?? 3,
          failTimeout: u.failTimeout ?? '10s',
          isBackup: u.isBackup ?? false,
          isActive: u.isActive ?? true,
          protocol: u.protocol ?? 'http',
          loadBalancerId: id,
        })),
      });
    }

    // If name changed, remove old config
    if (dto.name && dto.name !== existing.name) {
      try {
        await this.nginx.removeConfig(existing.name);
      } catch {
        // ignore if file doesn't exist
      }
    }

    const updated = await this.prisma.loadBalancer.update({
      where: { id },
      data: updateData,
      include: { upstreams: true },
    });

    // Re-apply nginx config
    if (updated.status === 'active') {
      await this.applyConfig(updated);
    }

    return updated;
  }

  /**
   * Delete a load balancer and its nginx config
   */
  async remove(id: number) {
    const lb = await this.findOne(id);

    // Remove nginx config
    try {
      await this.nginx.removeConfig(lb.name);
    } catch {
      // ignore errors
    }

    await this.prisma.loadBalancer.delete({ where: { id } });

    return { message: `LoadBalancer "${lb.name}" deleted` };
  }

  /**
   * Preview generated nginx config without applying
   */
  async preview(id: number) {
    const lb = await this.findOne(id);
    const activeUpstreams = lb.upstreams.filter(
      (u: { isActive: boolean }) => u.isActive,
    );

    return this.nginx.getConfigPreview({
      name: lb.name,
      listenPort: lb.listenPort,
      algorithm: lb.algorithm,
      enableFailover: lb.enableFailover,
      enableLoadBalancing: lb.enableLoadBalancing,
      upstreams: activeUpstreams,
    });
  }

  /**
   * Toggle status: active ↔ inactive
   */
  async toggleStatus(id: number) {
    const lb = await this.findOne(id);
    const newStatus = lb.status === 'active' ? 'inactive' : 'active';

    if (newStatus === 'inactive') {
      // Remove config when disabled
      try {
        await this.nginx.removeConfig(lb.name);
      } catch {
        // ignore
      }
    } else {
      // Apply config when enabled
      await this.applyConfig(lb);
    }

    return this.prisma.loadBalancer.update({
      where: { id },
      data: { status: newStatus },
      include: { upstreams: true },
    });
  }

  /**
   * Apply nginx config for a load balancer
   */
  private async applyConfig(lb: {
    name: string;
    listenPort: number;
    algorithm: string;
    enableFailover: boolean;
    enableLoadBalancing: boolean;
    upstreams: Array<{
      host: string;
      weight: number;
      maxFails: number;
      failTimeout: string;
      isBackup: boolean;
      isActive: boolean;
      id: number;
      protocol: string;
    }>;
  }) {
    const activeUpstreams = lb.upstreams.filter((u) => u.isActive);
    if (activeUpstreams.length === 0) {
      this.logger.warn(`No active upstreams for ${lb.name}`);
      return;
    }

    await this.nginx.generateAndApply({
      name: lb.name,
      listenPort: lb.listenPort,
      algorithm: lb.algorithm,
      enableFailover: lb.enableFailover,
      enableLoadBalancing: lb.enableLoadBalancing,
      upstreams: activeUpstreams,
    });
  }
}
