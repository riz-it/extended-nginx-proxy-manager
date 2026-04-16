// ── Type Definitions ────────────────────────────────────────

export interface Upstream {
  id?: number;
  host: string;
  weight: number;
  maxFails: number;
  failTimeout: string;
  isBackup: boolean;
  isActive: boolean;
  protocol?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoadBalancer {
  id: number;
  name: string;
  listenPort: number;
  status: 'active' | 'inactive' | 'error';
  algorithm: string;
  enableFailover: boolean;
  enableLoadBalancing: boolean;
  upstreams: Upstream[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLbPayload {
  name: string;
  listenPort: number;
  status?: string;
  algorithm: string;
  enableFailover: boolean;
  enableLoadBalancing: boolean;
  upstreams: Omit<Upstream, 'id' | 'createdAt' | 'updatedAt'>[];
}

export interface UpdateLbPayload {
  name?: string;
  listenPort?: number;
  status?: string;
  algorithm?: string;
  enableFailover?: boolean;
  enableLoadBalancing?: boolean;
  upstreams?: Omit<Upstream, 'createdAt' | 'updatedAt'>[];
}
