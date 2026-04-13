import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NginxService } from '../nginx/nginx.service';
import { CreateLbDto } from './dto/create-lb.dto';
import { UpdateLbDto } from './dto/update-lb.dto';

// ── Type interfaces for raw DB rows ──
interface LbRow {
  id: number;
  name: string;
  listen_port: number;
  status: string;
  algorithm: string;
  enable_failover: boolean;
  enable_load_balancing: boolean;
  custom_nginx_config: string | null;
  created_at: string;
  updated_at: string;
}

interface UpstreamRow {
  id: number;
  host: string;
  weight: number;
  max_fails: number;
  fail_timeout: string;
  is_backup: boolean;
  protocol: string;
  is_active: boolean;
  load_balancer_id: number;
  created_at: string;
  updated_at: string;
}

// ── Camelcase response types ──
export interface LbResponse {
  id: number;
  name: string;
  listenPort: number;
  status: string;
  algorithm: string;
  enableFailover: boolean;
  enableLoadBalancing: boolean;
  customNginxConfig: string | null;
  createdAt: string;
  updatedAt: string;
  upstreams: UpstreamResponse[];
}

export interface UpstreamResponse {
  id: number;
  host: string;
  weight: number;
  maxFails: number;
  failTimeout: string;
  isBackup: boolean;
  protocol: string;
  isActive: boolean;
  loadBalancerId: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class LbService {
  private readonly logger = new Logger(LbService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly nginx: NginxService,
  ) {}

  /**
   * Transform snake_case DB row to camelCase response
   */
  private transformLb(row: LbRow, upstreams: UpstreamRow[]): LbResponse {
    return {
      id: row.id,
      name: row.name,
      listenPort: row.listen_port,
      status: row.status,
      algorithm: row.algorithm,
      enableFailover: !!row.enable_failover,
      enableLoadBalancing: !!row.enable_load_balancing,
      customNginxConfig: row.custom_nginx_config || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      upstreams: upstreams.map((u) => this.transformUpstream(u)),
    };
  }

  private transformUpstream(row: UpstreamRow): UpstreamResponse {
    return {
      id: row.id,
      host: row.host,
      weight: row.weight,
      maxFails: row.max_fails,
      failTimeout: row.fail_timeout,
      isBackup: !!row.is_backup,
      protocol: row.protocol,
      isActive: !!row.is_active,
      loadBalancerId: row.load_balancer_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List all load balancers with upstreams
   */
  async findAll(): Promise<LbResponse[]> {
    const lbs = await this.db.knex<LbRow>('load_balancers')
      .select('*')
      .orderBy('created_at', 'desc');

    const lbIds = lbs.map((lb) => lb.id);

    let upstreams: UpstreamRow[] = [];
    if (lbIds.length > 0) {
      upstreams = await this.db.knex<UpstreamRow>('upstreams')
        .whereIn('load_balancer_id', lbIds)
        .orderBy('id', 'asc');
    }

    return lbs.map((lb) => {
      const lbUpstreams = upstreams.filter((u) => u.load_balancer_id === lb.id);
      return this.transformLb(lb, lbUpstreams);
    });
  }

  /**
   * Get single load balancer by ID
   */
  async findOne(id: number): Promise<LbResponse> {
    const lb = await this.db.knex<LbRow>('load_balancers')
      .where({ id })
      .first();

    if (!lb) {
      throw new NotFoundException(`LoadBalancer #${id} not found`);
    }

    const upstreams = await this.db.knex<UpstreamRow>('upstreams')
      .where({ load_balancer_id: id })
      .orderBy('id', 'asc');

    return this.transformLb(lb, upstreams);
  }

  /**
   * Create a new load balancer and generate nginx config
   */
  async create(dto: CreateLbDto): Promise<LbResponse> {
    if (!dto.name || !dto.upstreams || dto.upstreams.length === 0) {
      throw new BadRequestException('name and at least 1 upstream required');
    }

    // Sanitize name (only alphanumeric + hyphens)
    const safeName = dto.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const now = new Date().toISOString();

    // Insert load balancer
    const [lbId] = await this.db
      .knex('load_balancers')
      .insert({
        name: safeName,
        listen_port: dto.listenPort || 80,
        status: dto.status || 'active',
        algorithm: dto.algorithm || 'roundrobin',
        enable_failover: dto.enableFailover ?? true,
        enable_load_balancing: dto.enableLoadBalancing ?? true,
        custom_nginx_config: dto.customNginxConfig || null,
        created_at: now,
        updated_at: now,
      })
      .returning('id');

    // Handle different DB return formats
    const insertedId = typeof lbId === 'object' ? (lbId as { id: number }).id : lbId;

    // Insert upstreams
    const upstreamRows = dto.upstreams.map((u) => ({
      host: u.host,
      weight: u.weight ?? 1,
      max_fails: u.maxFails ?? 3,
      fail_timeout: u.failTimeout ?? '10s',
      is_backup: u.isBackup ?? false,
      is_active: u.isActive ?? true,
      protocol: u.protocol ?? 'http',
      load_balancer_id: insertedId,
      created_at: now,
      updated_at: now,
    }));

    await this.db.knex('upstreams').insert(upstreamRows);

    // Fetch the complete record
    const lb = await this.findOne(insertedId);

    // Generate and apply nginx config ONLY if active
    if (lb.status === 'active') {
      try {
        await this.applyConfig(lb);
      } catch (error) {
        // Rollback if nginx config fails
        this.logger.error(
          'Failed to apply nginx config, rolling back...',
          error,
        );
        await this.db.knex('upstreams').where({ load_balancer_id: insertedId }).delete();
        await this.db.knex('load_balancers').where({ id: insertedId }).delete();
        throw new BadRequestException(
          `Nginx config validation failed: ${error}`,
        );
      }
    }

    return lb;
  }

  /**
   * Update a load balancer (replace upstreams)
   */
  async update(id: number, dto: UpdateLbDto): Promise<LbResponse> {
    const existing = await this.findOne(id);
    const now = new Date().toISOString();

    // Build update data (snake_case for DB)
    const updateData: Record<string, unknown> = { updated_at: now };
    if (dto.name !== undefined) {
      updateData['name'] = dto.name
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
    }
    if (dto.listenPort !== undefined) {
      updateData['listen_port'] = dto.listenPort;
    }
    if (dto.status !== undefined) {
      updateData['status'] = dto.status;
    }
    if (dto.algorithm !== undefined) {
      updateData['algorithm'] = dto.algorithm;
    }
    if (dto.enableFailover !== undefined) {
      updateData['enable_failover'] = dto.enableFailover;
    }
    if (dto.enableLoadBalancing !== undefined) {
      updateData['enable_load_balancing'] = dto.enableLoadBalancing;
    }
    if (dto.customNginxConfig !== undefined) {
      updateData['custom_nginx_config'] = dto.customNginxConfig || null;
    }

    await this.db.knex('load_balancers').where({ id }).update(updateData);

    // If upstreams provided, replace all
    if (dto.upstreams && dto.upstreams.length > 0) {
      // Delete old upstreams
      await this.db.knex('upstreams').where({ load_balancer_id: id }).delete();

      // Create new ones
      const upstreamRows = dto.upstreams.map((u) => ({
        host: u.host!,
        weight: u.weight ?? 1,
        max_fails: u.maxFails ?? 3,
        fail_timeout: u.failTimeout ?? '10s',
        is_backup: u.isBackup ?? false,
        is_active: u.isActive ?? true,
        protocol: u.protocol ?? 'http',
        load_balancer_id: id,
        created_at: now,
        updated_at: now,
      }));

      await this.db.knex('upstreams').insert(upstreamRows);
    }

    // If name changed, remove old config
    if (dto.name && dto.name !== existing.name) {
      try {
        await this.nginx.removeConfig(existing.name);
      } catch {
        // ignore if file doesn't exist
      }
    }

    const updated = await this.findOne(id);

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

    // Cascade: delete upstreams first, then LB
    await this.db.knex('upstreams').where({ load_balancer_id: id }).delete();
    await this.db.knex('load_balancers').where({ id }).delete();

    return { message: `LoadBalancer "${lb.name}" deleted` };
  }

  /**
   * Preview generated nginx config without applying
   */
  async preview(id: number) {
    const lb = await this.findOne(id);
    const activeUpstreams = lb.upstreams.filter((u) => u.isActive);

    return this.nginx.getConfigPreview({
      name: lb.name,
      listenPort: lb.listenPort,
      algorithm: lb.algorithm,
      enableFailover: lb.enableFailover,
      enableLoadBalancing: lb.enableLoadBalancing,
      customNginxConfig: lb.customNginxConfig || '',
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

    await this.db.knex('load_balancers')
      .where({ id })
      .update({ status: newStatus, updated_at: new Date().toISOString() });

    return this.findOne(id);
  }

  /**
   * Apply nginx config for a load balancer
   */
  private async applyConfig(lb: LbResponse) {
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
      customNginxConfig: lb.customNginxConfig || '',
      upstreams: activeUpstreams,
    });
  }
}
