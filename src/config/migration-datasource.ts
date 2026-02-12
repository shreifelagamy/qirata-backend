import { DataSource } from 'typeorm';
import { configDotenv } from 'dotenv';
import * as entities from '../entities';

configDotenv();

/**
 * Data Source for TypeORM Migrations
 * 
 * This is a standalone configuration that doesn't start the Express server.
 * Used exclusively for running database migrations via CLI.
 */
export default new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    entities: Object.values(entities),
    migrations: [__dirname + "/../database/migrations/**/*.{ts,js}"],
    migrationsTableName: "migrations",
    migrationsRun: false,
    logging: ["query", "error", "schema"]
});
