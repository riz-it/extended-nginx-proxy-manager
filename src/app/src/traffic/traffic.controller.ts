import { Controller, Get, Query } from '@nestjs/common';
import { TrafficService } from './traffic.service';

@Controller('traffic')
export class TrafficController {
  constructor(private readonly trafficService: TrafficService) {}

  @Get()
  async getTraffic(@Query('days') days?: string, @Query('lbId') lbId?: string) {
    const parsedDays = days ? parseInt(days, 10) : 7;
    const records = await this.trafficService.getTrafficHistory({
      days: parsedDays,
      lbId: lbId ? parseInt(lbId, 10) : undefined,
    });
    
    const lbNamesMap = await this.trafficService.getLbNamesMap();

    // Aggregating for standard charts.
    const timeBucketMap: Record<string, { requests: number; bytes: number }> = {};
    const upstreamMap: Record<string, { requests: number; bytes: number }> = {};
    const lbMap: Record<string, { requests: number; bytes: number }> = {};

    let totalRequests = 0;
    let totalBytes = 0;

    for (const r of records) {
      // Create a key for bucket based on timespan
      const rDate = new Date(r.timestamp);
      
      if (parsedDays <= 1) {
        // Group by Hour (24 points)
        rDate.setMinutes(0, 0, 0); 
      } else if (parsedDays <= 7) {
        // Group by every 4 hours for a smoother 7-day chart (42 points)
        const hour = rDate.getHours();
        const groupedHour = Math.floor(hour / 4) * 4;
        rDate.setHours(groupedHour, 0, 0, 0);
      } else {
        // Group by Day (e.g. 30 points for 30 days)
        rDate.setHours(0, 0, 0, 0);
      }
      
      const timeKey = rDate.toISOString();

      if (!timeBucketMap[timeKey]) {
        timeBucketMap[timeKey] = { requests: 0, bytes: 0 };
      }
      timeBucketMap[timeKey].requests += r.request_count;
      timeBucketMap[timeKey].bytes += Number(r.bytes_sent);

      // Upstream totals
      const upKey = r.upstream_host;
      if (!upstreamMap[upKey]) upstreamMap[upKey] = { requests: 0, bytes: 0 };
      upstreamMap[upKey].requests += r.request_count;
      upstreamMap[upKey].bytes += Number(r.bytes_sent);

      // LB totals
      const lb = String(r.load_balancer_id);
      if (!lbMap[lb]) lbMap[lb] = { requests: 0, bytes: 0 };
      lbMap[lb].requests += r.request_count;
      lbMap[lb].bytes += Number(r.bytes_sent);

      totalRequests += r.request_count;
      totalBytes += Number(r.bytes_sent);
    }

    const timeSeries = Object.keys(timeBucketMap).sort().map(k => ({
      time: k,
      requests: timeBucketMap[k].requests,
      bytes: timeBucketMap[k].bytes
    }));

    const upstreams = Object.keys(upstreamMap).map(k => ({
      upstream: k,
      requests: upstreamMap[k].requests,
      bytes: upstreamMap[k].bytes
    }));

    const loadBalancers = Object.keys(lbMap).map(k => ({
      lbId: k,
      lbName: lbNamesMap[k] || `LB #${k}`,
      requests: lbMap[k].requests,
      bytes: lbMap[k].bytes
    }));

    return {
      totalRequests,
      totalBytes,
      timeSeries,
      upstreams,
      loadBalancers
    };
  }
}
