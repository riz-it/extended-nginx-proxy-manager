import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private publicKey: string | null = null;
  // Usually NPM API is available at localhost:81 internally
  private readonly npmApiUrl = process.env.NPM_API_URL || 'http://127.0.0.1:81';

  constructor() {
    this.loadPublicKey();
  }

  private loadPublicKey() {
    try {
      const possibePaths = [
        '/data/keys.json', // NPM container path
        path.join(process.cwd(), '..', 'data', 'keys.json'), // Local dev workspace
        path.join(process.cwd(), 'data', 'keys.json'), // Fallback
      ];

      for (const p of possibePaths) {
        if (fs.existsSync(p)) {
          const keys = JSON.parse(fs.readFileSync(p, 'utf8'));
          this.publicKey = keys.pub;
          this.logger.log(`NPM Public Key loaded from ${p}`);
          return;
        }
      }
      this.logger.warn(
        'NPM Public Key not found. Token validation will fall back to NPM API.',
      );
    } catch (e) {
      this.logger.error('Failed to load NPM JWT Public Key', e);
    }
  }

  async login(
    identity: string,
    secret: string,
  ): Promise<{ token: string; expires: string }> {
    try {
      const response = await fetch(`${this.npmApiUrl}/api/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, secret }),
      });

      if (!response.ok) {
        throw new UnauthorizedException('Invalid credentials from NPM');
      }

      const data = await response.json();
      return { token: data.token, expires: data.expires };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(error);
      throw new UnauthorizedException('NPM Login Proxy failed');
    }
  }

  async verifyLocal(token: string): Promise<any> {
    // 1. Try blazing fast local JWT RSA verify
    if (!this.publicKey) {
      this.loadPublicKey();
    }

    if (this.publicKey) {
      try {
        return jwt.verify(token, this.publicKey, { algorithms: ['RS256'] });
      } catch (e) {
        throw new UnauthorizedException('Invalid NPM Token');
      }
    }

    // 2. Network fallback if keys.json isn't mounted: fetch from NPM
    try {
      const response = await fetch(`${this.npmApiUrl}/api/tokens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        // Token valid
        return { valid: true };
      }
      throw new Error('NPM returned unauthorized');
    } catch (e) {
      throw new UnauthorizedException('NPM Token verification failed');
    }
  }
}
