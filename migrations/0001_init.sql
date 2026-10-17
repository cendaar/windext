-- windext schema v1. No personal data anywhere.
CREATE TABLE IF NOT EXISTS spots (
  id TEXT PRIMARY KEY,                 -- slug, e.g. "ouistreham-riva-bella"
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '',    -- lowercase, '|' separated
  lat REAL NOT NULL, lon REAL NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  water TEXT NOT NULL DEFAULT '',      -- sea | lagoon | lake | river | estuary
  facing_deg REAL,                     -- direction the launch beach faces, towards the water
  facing_source TEXT NOT NULL DEFAULT '', -- guide | user | coastline | seed
  sports TEXT NOT NULL DEFAULT '',     -- kitesurf|windsurf|wingfoil|sailing, '|' separated
  tide_notes TEXT NOT NULL DEFAULT '',
  hazards TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '',
  launch_notes TEXT NOT NULL DEFAULT '',
  season TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'community', -- seed | community | verified
  sources TEXT NOT NULL DEFAULT '',    -- URLs, '|' separated
  submissions INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS spots_latlon ON spots(lat, lon);
CREATE INDEX IF NOT EXISTS spots_name ON spots(name);

-- Which wind directions work at a spot. sector = 16-point compass label (N, NNE, ...).
CREATE TABLE IF NOT EXISTS spot_wind (
  spot_id TEXT NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  sector TEXT NOT NULL,
  quality TEXT NOT NULL,               -- best | ok | marginal | forbidden
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (spot_id, sector)
);

-- Proposed changes to a verified spot wait here instead of overwriting it.
CREATE TABLE IF NOT EXISTS spot_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spot_id TEXT NOT NULL,
  payload TEXT NOT NULL,               -- JSON of the submitted card
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  reviewed INTEGER NOT NULL DEFAULT 0
);

-- Anonymous demand signal: which spots people ask about and when.
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spot_id TEXT,                        -- null when the request was by coordinates only
  lat REAL NOT NULL, lon REAL NOT NULL,
  day TEXT NOT NULL,                   -- first forecast day asked
  sport TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- One archived forecast per spot/day/model/hour, kept so session reports can be scored later.
CREATE TABLE IF NOT EXISTS forecast_archive (
  spot_key TEXT NOT NULL,              -- spot id, or "lat,lon" rounded to 2 decimals
  day TEXT NOT NULL,
  model TEXT NOT NULL,
  hour INTEGER NOT NULL,
  speed REAL, gust REAL, dir REAL,
  fetched_at TEXT NOT NULL,
  lead_hours INTEGER NOT NULL,         -- hours between fetch and the forecast hour
  PRIMARY KEY (spot_key, day, model, hour, fetched_at)
);

-- Rider-reported outcome of a session (phase 3 fills it; table created now so the archive has a purpose).
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spot_id TEXT, lat REAL, lon REAL,
  day TEXT NOT NULL,
  hour_from INTEGER, hour_to INTEGER,
  speed REAL, gust REAL, dir REAL,
  sport TEXT NOT NULL DEFAULT '',
  rider_kg REAL, gear TEXT NOT NULL DEFAULT '', verdict TEXT NOT NULL DEFAULT '', -- underpowered | ok | overpowered
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
