import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';
import { exec } from 'child_process';

@Injectable()
export class NginxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NginxService.name);
  private readonly templatePath = path.join(
    __dirname,
    'templates',
    'upstream.conf.ejs',
  );
  private readonly customDir =
    process.env.NGINX_CUSTOM_DIR || '/data/nginx/custom';

  // Individual LB configs stored here
  private readonly lbDir = path.join(
    process.env.NGINX_CUSTOM_DIR || '/data/nginx/custom',
    'lb',
  );

  // NPM includes this file inside http{} block
  private readonly httpConfPath = path.join(
    process.env.NGINX_CUSTOM_DIR || '/data/nginx/custom',
    'http.conf',
  );

  private pollInterval: NodeJS.Timeout | null = null;
  private lastMtime: number = 0;

  onModuleInit() {
    this.logger.log('Starting GlusterFS changes watcher (polling)...');
    // Poll every 5 seconds to detect cross-VM config changes
    this.pollInterval = setInterval(() => this.checkForConfigChanges(), 5000);
  }

  onModuleDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private checkForConfigChanges() {
    const cmd =
      "find /data/nginx /etc/letsencrypt -type f -printf '%T@\\n' 2>/dev/null | sort -n | tail -1";
    exec(cmd, (err, stdout) => {
      if (!err && stdout) {
        const currentMtime = parseFloat(stdout.trim());

        if (!isNaN(currentMtime)) {
          if (this.lastMtime === 0) {
            // First run, just set the baseline
            this.lastMtime = currentMtime;
          } else if (currentMtime > this.lastMtime) {
            this.logger.log(
              `Detected config change on GlusterFS (mtime: ${currentMtime} > ${this.lastMtime}). Reloading Nginx...`,
            );
            this.lastMtime = currentMtime;

            // Reload Nginx smoothly
            this.execCmd('nginx -s reload').catch((e: unknown) => {
              const errMsg = e instanceof Error ? e.message : String(e);
              this.logger.warn(
                'Failed to reload Nginx from watch event: ' + errMsg,
              );
            });
          }
        }
      }
    });
  }

  private execCmd(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          this.logger.error(`Command failed: ${cmd}`, stderr);
          return reject(new Error(stderr || err.message));
        }
        resolve(stdout);
      });
    });
  }

  /**
   * Merge all individual LB configs into a single http.conf
   * NPM only includes /data/nginx/custom/http.conf inside the http{} block
   */
  private mergeConfigs(): void {
    if (!fs.existsSync(this.lbDir)) {
      // No LB configs, write empty http.conf
      fs.writeFileSync(
        this.httpConfPath,
        '# Custom Load Balancer configs — auto-generated, do not edit\n',
        'utf-8',
      );
      return;
    }

    const files = fs
      .readdirSync(this.lbDir)
      .filter((f) => f.endsWith('.conf'))
      .sort();

    const parts = [
      '# Custom Load Balancer configs — auto-generated, do not edit',
      `# Last updated: ${new Date().toISOString()}`,
      `# Total LBs: ${files.length}`,
      '',
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.lbDir, file), 'utf-8');
      parts.push(`# ── ${file} ──`);
      parts.push(content);
      parts.push('');
    }

    fs.writeFileSync(this.httpConfPath, parts.join('\n'), 'utf-8');
    this.logger.log(`Merged ${files.length} LB config(s) into http.conf`);
  }

  /**
   * Generate nginx config from template and apply it
   */
  async generateAndApply(config: {
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
      id: number;
      protocol: string;
    }>;
  }): Promise<void> {
    // Ensure directories exist
    if (!fs.existsSync(this.lbDir)) {
      fs.mkdirSync(this.lbDir, { recursive: true });
    }

    // Read and render template
    const template = fs.readFileSync(this.templatePath, 'utf-8');
    const rendered = ejs.render(template, config);

    // Write individual config to lb/ subdirectory
    const filePath = path.join(this.lbDir, `${config.name}.conf`);
    fs.writeFileSync(filePath, rendered, 'utf-8');
    this.logger.log(`Config written: ${filePath}`);

    // Merge all configs into http.conf
    this.mergeConfigs();

    // Validate nginx config
    await this.validate();

    // Reload nginx
    await this.reload();
  }

  /**
   * Remove a config file and reload
   */
  async removeConfig(name: string): Promise<void> {
    const filePath = path.join(this.lbDir, `${name}.conf`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`Config removed: ${filePath}`);

      // Re-merge remaining configs
      this.mergeConfigs();

      // Validate and reload
      await this.validate();
      await this.reload();
    }
  }

  /**
   * Validate nginx configuration
   */
  async validate(): Promise<string> {
    try {
      const result = await this.execCmd('nginx -t 2>&1');
      this.logger.log('Nginx config validation passed');
      return result;
    } catch (error) {
      this.logger.error('Nginx config validation FAILED');
      throw error;
    }
  }

  /**
   * Reload nginx (graceful — no downtime)
   */
  async reload(): Promise<void> {
    await this.execCmd('nginx -s reload');
    this.logger.log('Nginx reloaded successfully');
  }

  /**
   * Get generated config content for preview
   */
  getConfigPreview(config: {
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
    }>;
  }): string {
    const template = fs.readFileSync(this.templatePath, 'utf-8');
    return ejs.render(template, config);
  }

  /**
   * List all generated config files
   */
  listConfigs(): string[] {
    if (!fs.existsSync(this.lbDir)) {
      return [];
    }
    return fs.readdirSync(this.lbDir).filter((f) => f.endsWith('.conf'));
  }
}
