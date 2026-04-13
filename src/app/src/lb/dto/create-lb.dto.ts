export class CreateUpstreamDto {
  host!: string;
  weight?: number;
  maxFails?: number;
  failTimeout?: string;
  isBackup?: boolean;
  isActive?: boolean;
  protocol?: string;
}

export class CreateLbDto {
  name!: string;
  listenPort?: number;
  status?: string;
  algorithm?: string;
  enableFailover?: boolean;
  enableLoadBalancing?: boolean;
  customNginxConfig?: string;
  upstreams!: CreateUpstreamDto[];
}
