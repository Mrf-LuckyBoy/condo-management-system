CREATE TABLE "buildings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "building_name" TEXT,
    "owner_name" TEXT,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME
);

CREATE TABLE "setting_building" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "building_id" INTEGER NOT NULL,
    "electricity_per_unit" REAL,
    "water_per_unit" REAL,
    "base_maintain" REAL,
    "trash_maintain" REAL,
    "meter_maintain" REAL,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME,
    CONSTRAINT "setting_building_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "rooms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "building_id" INTEGER NOT NULL,
    "room_number" INTEGER,
    "rent_name" TEXT,
    "rent_price" REAL,
    "electricity_unit" INTEGER,
    "water_unit" INTEGER,
    "is_owner" INTEGER DEFAULT 0,
    "is_active" INTEGER DEFAULT 1,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME,
    CONSTRAINT "rooms_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "billing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "electricity" REAL,
    "water" REAL,
    "maintain" REAL,
    "trash_maintain" REAL,
    "meter_maintain" REAL,
    "is_pay_rent" INTEGER DEFAULT 0,
    "is_paid" INTEGER DEFAULT 0,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME,
    CONSTRAINT "billing_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "meter_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" INTEGER NOT NULL,
    "old_electricity_unit" INTEGER,
    "new_electricity_unit" INTEGER,
    "old_water_unit" INTEGER,
    "new_water_unit" INTEGER,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME,
    CONSTRAINT "meter_log_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "setting_building_building_id_key" ON "setting_building"("building_id");

CREATE TRIGGER "trg_rooms_meter_log"
AFTER UPDATE OF "electricity_unit", "water_unit" ON "rooms"
FOR EACH ROW
WHEN OLD."electricity_unit" IS NOT NEW."electricity_unit"
  OR OLD."water_unit" IS NOT NEW."water_unit"
BEGIN
  INSERT INTO "meter_log" (
    "room_id", "old_electricity_unit", "new_electricity_unit",
    "old_water_unit", "new_water_unit", "created_at", "updated_at"
  ) VALUES (
    NEW."id", OLD."electricity_unit", NEW."electricity_unit",
    OLD."water_unit", NEW."water_unit", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  );
END;
