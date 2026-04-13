import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import knex, { Knex } from 'knex';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private _knex!: Knex;

  get knex(): Knex {
    return this._knex;
  }

  async onModuleInit() {
    const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();

    this.logger.log(`Initializing database connection (engine: ${dbType})...`);

    this._knex = knex(this.buildKnexConfig(dbType));

    // Test connection
    try {
      await this._knex.raw('SELECT 1');
      this.logger.log('Database connection established successfully.');
    } catch (error) {
      this.logger.error('Failed to connect to database.');
      if (error instanceof Error) {
        this.logger.error(error.message);
      }
      throw error;
    }

    // Run additive migration — only CREATE IF NOT EXISTS
    await this.runMigration();
  }

  async onModuleDestroy() {
    if (this._knex) {
      await this._knex.destroy();
      this.logger.log('Database connection closed.');
    }
  }

  /**
   * Build Knex configuration based on DB_TYPE environment variable.
   * Supports: sqlite, mysql, postgresql
   */
  private buildKnexConfig(dbType: string): Knex.Config {
    switch (dbType) {
      case 'mysql':
        return {
          client: 'mysql2',
          connection: {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306', 10),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'npm',
          },
          pool: { min: 0, max: 10 },
        };

      case 'postgresql':
      case 'postgres':
        return {
          client: 'pg',
          connection: {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'npm',
          },
          pool: { min: 0, max: 10 },
        };

      case 'sqlite':
      default:
        // Default SQLite path inside the container, or local dev
        const sqlitePath =
          process.env.DB_SQLITE_FILE ||
          (process.env.NODE_ENV === 'production'
            ? '/data/custom-lb.sqlite'
            : './dev.db');
        return {
          client: 'better-sqlite3',
          connection: {
            filename: sqlitePath,
          },
          useNullAsDefault: true,
        };
    }
  }

  /**
   * Run additive-only migration.
   * Creates tables IF NOT EXISTS — never drops or modifies existing NPM tables.
   */
  private async runMigration() {
    this.logger.log('Running additive database migration...');

    // ── load_balancers table ──
    const hasLbTable = await this._knex.schema.hasTable('load_balancers');
    if (!hasLbTable) {
      this.logger.log('Creating table: load_balancers');
      await this._knex.schema.createTable('load_balancers', (table) => {
        table.increments('id').primary();
        table.string('name').unique().notNullable();
        table.integer('listen_port').notNullable().defaultTo(80);
        table.string('status').notNullable().defaultTo('active');
        table.string('algorithm').notNullable().defaultTo('roundrobin');
        table.boolean('enable_failover').notNullable().defaultTo(true);
        table.boolean('enable_load_balancing').notNullable().defaultTo(true);
        table.timestamp('created_at').defaultTo(this._knex.fn.now());
        table.timestamp('updated_at').defaultTo(this._knex.fn.now());
      });
    } else {
      this.logger.log('Table load_balancers already exists, checking for new columns...');
      // Add any new columns that might have been added in schema updates
      await this.addColumnIfNotExists('load_balancers', 'algorithm', (table) =>
        table.string('algorithm').notNullable().defaultTo('roundrobin'),
      );
      await this.addColumnIfNotExists('load_balancers', 'enable_failover', (table) =>
        table.boolean('enable_failover').notNullable().defaultTo(true),
      );
      await this.addColumnIfNotExists('load_balancers', 'enable_load_balancing', (table) =>
        table.boolean('enable_load_balancing').notNullable().defaultTo(true),
      );
    }

    // ── upstreams table ──
    const hasUpstreamTable = await this._knex.schema.hasTable('upstreams');
    if (!hasUpstreamTable) {
      this.logger.log('Creating table: upstreams');
      await this._knex.schema.createTable('upstreams', (table) => {
        table.increments('id').primary();
        table.string('host').notNullable();
        table.integer('weight').notNullable().defaultTo(1);
        table.integer('max_fails').notNullable().defaultTo(3);
        table.string('fail_timeout').notNullable().defaultTo('10s');
        table.boolean('is_backup').notNullable().defaultTo(false);
        table.string('protocol').notNullable().defaultTo('http');
        table.boolean('is_active').notNullable().defaultTo(true);
        table
          .integer('load_balancer_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('load_balancers')
          .onDelete('CASCADE');
        table.timestamp('created_at').defaultTo(this._knex.fn.now());
        table.timestamp('updated_at').defaultTo(this._knex.fn.now());
      });
    } else {
      this.logger.log('Table upstreams already exists, checking for new columns...');
      await this.addColumnIfNotExists('upstreams', 'protocol', (table) =>
        table.string('protocol').notNullable().defaultTo('http'),
      );
    }

    this.logger.log('Database migration completed successfully.');
  }

  /**
   * Safely add a column if it doesn't exist yet.
   */
  private async addColumnIfNotExists(
    tableName: string,
    columnName: string,
    columnBuilder: (table: Knex.AlterTableBuilder) => void,
  ) {
    const hasColumn = await this._knex.schema.hasColumn(tableName, columnName);
    if (!hasColumn) {
      this.logger.log(`Adding column ${columnName} to ${tableName}`);
      await this._knex.schema.alterTable(tableName, columnBuilder);
    }
  }
}
