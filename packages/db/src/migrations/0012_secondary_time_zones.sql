-- Extra hour columns in the day and week views: a JSON array of IANA zones. Existing installations show none.
ALTER TABLE settings ADD COLUMN secondary_time_zones TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(secondary_time_zones) AND json_type(secondary_time_zones) = 'array');
