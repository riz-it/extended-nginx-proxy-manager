export class CreateUpstreamDto {
  host!: string;
  weight?: number;
  maxFails?: number;
  failTimeout?: string;
  isBackup?: boolean;
  protocol?: string;
}

export class CreateLbDto {
  name!: string;
  listenPort?: number;
  status?: string;
  upstreams!: CreateUpstreamDto[];
}
