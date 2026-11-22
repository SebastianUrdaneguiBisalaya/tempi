-- Weather in the sidebar (Open-Meteo, free plan): on by default. The place is JSON ({ name, region, latitude, longitude })
-- or NULL until the user picks one, which shows the city of the profile's time zone.
ALTER TABLE settings ADD COLUMN weather_enabled INTEGER NOT NULL DEFAULT 1 CHECK (weather_enabled IN (0, 1));
ALTER TABLE settings ADD COLUMN weather_location TEXT CHECK (weather_location IS NULL OR (json_valid(weather_location) AND json_type(weather_location) = 'object'));
