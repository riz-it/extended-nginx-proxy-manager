export class UpdateUpstreamDto {
  id?: number;
  host?: string;
  weight?: number;
  maxFails?: number;
  failTimeout?: string;
  isBackup?: boolean;
  isActive?: boolean;
  protocol?: string;
}

export class UpdateLbDto {
  name?: string;
  listenPort?: number;
  status?: string;
  algorithm?: string;
  enableFailover?: boolean;
  enableLoadBalancing?: boolean;
  upstreams?: UpdateUpstreamDto[];
}
