import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import * as dgram from 'dgram';

interface TrafficPayload {
  lb_id: string;
  upstream: string;
  bytes: string;
}

// Memory structure: trafficMap[lbId][upstream] = { requests, bytes }
type AggregatedTraffic = Record<string, Record<string, { requests: number; bytes: number }>>;

@Injectable()
export class TrafficService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrafficService.name);
  private server: dgram.Socket;
  private trafficMap: AggregatedTraffic = {};
  
  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    this.server = dgram.createSocket('udp4');
    
    this.server.on('error', (err) => {
      this.logger.error(`UDP server error:\n${err.stack}`);
      this.server.close();
    });

    this.server.on('message', (msg, rinfo) => {
      this.handleSyslogMessage(msg.toString('utf8'));
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      this.logger.log(`Traffic UDP aggregator listening on ${address.address}:${address.port}`);
    });

    // We bind it specifically to localhost since Nginx is in the same container.
    this.server.bind(44444, '127.0.0.1');
  }

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
    }
  }

  private handleSyslogMessage(msg: string) {
    try {
      // Syslog usually has a prefix like "<190>Oct 12 00:00:00 lb: {JSON...}"
      // We need to extract the JSON part. The JSON format should start at the first '{'
      const jsonStart = msg.indexOf('{');
      if (jsonStart === -1) return;
      
      const jsonStr = msg.substring(jsonStart);
      const data: TrafficPayload = JSON.parse(jsonStr);
      
      const lbId = data.lb_id;
      if (!lbId || lbId === '-') return;

      const upstream = data.upstream || '-';
      const bytesStr = data.bytes || '0';
      const bytes = isNaN(parseInt(bytesStr, 10)) ? 0 : parseInt(bytesStr, 10);

      // Increment counters in memory
      if (!this.trafficMap[lbId]) {
        this.trafficMap[lbId] = {};
      }
      if (!this.trafficMap[lbId][upstream]) {
        this.trafficMap[lbId][upstream] = { requests: 0, bytes: 0 };
      }

      this.trafficMap[lbId][upstream].requests += 1;
      this.trafficMap[lbId][upstream].bytes += bytes;
    } catch (e) {
      // Ignore parsing errors for malformed logs
    }
  }

  // Flushing to DB every 1 minute
  @Cron(CronExpression.EVERY_MINUTE)
  async flushToDatabase() {
    // Take a snapshot
    const snapshot = this.trafficMap;
    this.trafficMap = {}; // Reset map immediately

    const timestamp = new Date(); // Nearest minute is good enough
    timestamp.setSeconds(0, 0);

    const records = [];

    for (const lbId of Object.keys(snapshot)) {
      for (const upstream of Object.keys(snapshot[lbId])) {
        const stats = snapshot[lbId][upstream];
        const parsedLbId = parseInt(lbId, 10);
        
        if (!isNaN(parsedLbId)) {
          records.push({
            timestamp,
            load_balancer_id: parsedLbId,
            upstream_host: upstream,
            request_count: stats.requests,
            bytes_sent: stats.bytes
          });
        }
      }
    }

    if (records.length > 0) {
      try {
        await this.db.knex('traffic_stats').insert(records);
      } catch (err) {
        this.logger.error('Failed to flush traffic stats to DB', err);
      }
    }
  }

  // Pruning old records (keep DB small) - Run every day at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async pruneOldRecords() {
    this.logger.log('Pruning 30-day old traffic stats...');
    try {
      // SQLite syntax mostly supports datetime modifiers, but relying on JS dates is safer
      const cleanupDate = new Date();
      cleanupDate.setDate(cleanupDate.getDate() - 30);
      
      await this.db.knex('traffic_stats')
        .where('timestamp', '<', cleanupDate)
        .delete();
        
    } catch (err) {
      this.logger.error('Failed to prune traffic stats', err);
    }
  }

  // API Methods
  async getTrafficHistory(options: { days?: number, lbId?: number }) {
    const days = options.days || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    let query = this.db.knex('traffic_stats')
      .where('timestamp', '>=', since);

    if (options.lbId) {
      query = query.where('load_balancer_id', options.lbId);
    }

    // Default to sqlite date functions if db uses sqlite, but Knex might need raw handling
    // We can just fetch the raw points and group in typescript, since 7 days per minute is small enough (10080 points flat)
    const records = await query;
    return records;
  }

  async getLbNamesMap(): Promise<Record<string, string>> {
    const lbs = await this.db.knex('load_balancers').select('id', 'name');
    const map: Record<string, string> = {};
    for (const lb of lbs) {
      map[String(lb.id)] = lb.name;
    }
    return map;
  }
}
