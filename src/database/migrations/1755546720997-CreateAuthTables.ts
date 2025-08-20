import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateAuthTables1755546720997 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // User table - core authentication
        await queryRunner.query(`
            CREATE TABLE "user" (
                "id" VARCHAR NOT NULL,
                "name" VARCHAR NOT NULL,
                "email" VARCHAR NOT NULL,
                "emailVerified" BOOLEAN NOT NULL DEFAULT false,
                "image" VARCHAR,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_user_email" UNIQUE ("email")
            );
        `);

        // Session table - authentication sessions
        await queryRunner.query(`
            CREATE TABLE "session" (
                "id" VARCHAR NOT NULL,
                "userId" VARCHAR NOT NULL,
                "token" VARCHAR NOT NULL,
                "ipAddress" VARCHAR,
                "userAgent" VARCHAR,
                "expiresAt" TIMESTAMP NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_session" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_session_token" UNIQUE ("token"),
                CONSTRAINT "FK_session_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
            );
        `);

        // Account table - OAuth and external accounts
        await queryRunner.query(`
            CREATE TABLE "account" (
                "id" VARCHAR NOT NULL,
                "userId" VARCHAR NOT NULL,
                "accountId" VARCHAR NOT NULL,
                "providerId" VARCHAR NOT NULL,
                "accessToken" VARCHAR,
                "refreshToken" VARCHAR,
                "idToken" VARCHAR,
                "accessTokenExpiresAt" TIMESTAMP,
                "refreshTokenExpiresAt" TIMESTAMP,
                "scope" VARCHAR,
                "password" VARCHAR,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_account" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_account_provider" UNIQUE ("providerId", "accountId"),
                CONSTRAINT "FK_account_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
            );
        `);

        // Verification table - email verification and password reset
        await queryRunner.query(`
            CREATE TABLE "verification" (
                "id" VARCHAR NOT NULL,
                "identifier" VARCHAR NOT NULL,
                "value" VARCHAR NOT NULL,
                "expiresAt" TIMESTAMP NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_verification" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_verification_identifier" UNIQUE ("identifier")
            );
        `);

        // JWKS table - JSON Web Key Set for authentication keys
        await queryRunner.query(`
            CREATE TABLE "jwks" (
                "id" VARCHAR NOT NULL,
                "publicKey" VARCHAR NOT NULL,
                "privateKey" VARCHAR NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_jwks" PRIMARY KEY ("id")
            );
        `);

        // Create indexes for better performance
        await queryRunner.query(`CREATE INDEX "IDX_session_userId" ON "session" ("userId");`);
        await queryRunner.query(`CREATE INDEX "IDX_session_token" ON "session" ("token");`);
        await queryRunner.query(`CREATE INDEX "IDX_session_expiresAt" ON "session" ("expiresAt");`);
        await queryRunner.query(`CREATE INDEX "IDX_account_userId" ON "account" ("userId");`);
        await queryRunner.query(`CREATE INDEX "IDX_account_providerId" ON "account" ("providerId");`);
        await queryRunner.query(`CREATE INDEX "IDX_verification_identifier" ON "verification" ("identifier");`);
        await queryRunner.query(`CREATE INDEX "IDX_verification_expiresAt" ON "verification" ("expiresAt");`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "IDX_verification_expiresAt";`);
        await queryRunner.query(`DROP INDEX "IDX_verification_identifier";`);
        await queryRunner.query(`DROP INDEX "IDX_account_providerId";`);
        await queryRunner.query(`DROP INDEX "IDX_account_userId";`);
        await queryRunner.query(`DROP INDEX "IDX_session_expiresAt";`);
        await queryRunner.query(`DROP INDEX "IDX_session_token";`);
        await queryRunner.query(`DROP INDEX "IDX_session_userId";`);
        
        // Drop tables in reverse order (due to foreign key constraints)
        await queryRunner.query(`DROP TABLE "jwks";`);
        await queryRunner.query(`DROP TABLE "verification";`);
        await queryRunner.query(`DROP TABLE "account";`);
        await queryRunner.query(`DROP TABLE "session";`);
        await queryRunner.query(`DROP TABLE "user";`);
    }

}
