-- CreateTable
CREATE TABLE "load_balancers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "listen_port" INTEGER NOT NULL DEFAULT 80,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "upstreams" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "host" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "max_fails" INTEGER NOT NULL DEFAULT 3,
    "fail_timeout" TEXT NOT NULL DEFAULT '10s',
    "is_backup" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "load_balancer_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "upstreams_load_balancer_id_fkey" FOREIGN KEY ("load_balancer_id") REFERENCES "load_balancers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "load_balancers_name_key" ON "load_balancers"("name");
