-- Event search: an FTS5 index over each event's title, location and description. It reads the text from `events`
-- (external content) and triggers keep it in sync. `unicode61 remove_diacritics 2` folds case and accents, so
-- "reunion" finds "Reunión".
CREATE VIRTUAL TABLE events_search USING fts5(
	title,
	location,
	description,
	content = 'events',
	content_rowid = 'rowid',
	tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER events_search_insert AFTER INSERT ON events BEGIN
	INSERT INTO events_search (rowid, title, location, description) VALUES (new.rowid, new.title, new.location, new.description);
END;

CREATE TRIGGER events_search_delete AFTER DELETE ON events BEGIN
	INSERT INTO events_search (events_search, rowid, title, location, description) VALUES ('delete', old.rowid, old.title, old.location, old.description);
END;

CREATE TRIGGER events_search_update AFTER UPDATE OF title, location, description ON events BEGIN
	INSERT INTO events_search (events_search, rowid, title, location, description) VALUES ('delete', old.rowid, old.title, old.location, old.description);
	INSERT INTO events_search (rowid, title, location, description) VALUES (new.rowid, new.title, new.location, new.description);
END;

-- Index the events that already exist.
INSERT INTO events_search (events_search) VALUES ('rebuild');
