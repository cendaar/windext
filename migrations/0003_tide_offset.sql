-- Per-spot tide calibration: minutes to add to the model's high/low water times, learned from a local port table confirmed by a rider.
ALTER TABLE spots ADD COLUMN tide_offset_min INTEGER;
