-- 角色表新增 nicknames 欄位（JSON 陣列字串，如 ["暱稱1","暱稱2"]）
ALTER TABLE characters ADD COLUMN nicknames TEXT;