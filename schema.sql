CREATE TABLE IF NOT EXISTS announcements(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,author TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS site_settings(id TEXT PRIMARY KEY,headline TEXT NOT NULL DEFAULT '빛나는 존재감, 함께 만드는 채리온.',show_announcements INTEGER NOT NULL DEFAULT 1,show_board INTEGER NOT NULL DEFAULT 1);
INSERT OR IGNORE INTO site_settings(id,headline,show_announcements,show_board) VALUES('main','빛나는 존재감, 함께 만드는 채리온.',1,1);
