-- kind: what the OSM object or submission is. spot = a place to ride; school = club, school, shop, centre near a spot.
ALTER TABLE spots ADD COLUMN kind TEXT NOT NULL DEFAULT 'spot';
