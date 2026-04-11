-- CreateTable
CREATE TABLE IF NOT EXISTS "load_balancers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "listen_port" INTEGER NOT NULL DEFAULT 80,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "load_balancers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "upstreams" (
    "id" SERIAL NOT NULL,
    "host" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "max_fails" INTEGER NOT NULL DEFAULT 3,
    "fail_timeout" TEXT NOT NULL DEFAULT '10s',
    "is_backup" BOOLEAN NOT NULL DEFAULT false,
    "protocol" TEXT NOT NULL DEFAULT 'http',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "load_balancer_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upstreams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "load_balancers_name_key" ON "load_balancers"("name");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'upstreams_load_balancer_id_fkey'
    ) THEN
        ALTER TABLE "upstreams" ADD CONSTRAINT "upstreams_load_balancer_id_fkey" FOREIGN KEY ("load_balancer_id") REFERENCES "load_balancers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
