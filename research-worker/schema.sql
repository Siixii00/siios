-- 每個（匿名編號, 週別）一列；apps 是用過的 App 名稱（JSON 字串陣列，只可能是白名單內的固定名稱）。
-- 刻意不存：IP、User-Agent、時間戳記、任何內容。
CREATE TABLE IF NOT EXISTS app_usage (
  pid  TEXT NOT NULL,
  week TEXT NOT NULL,
  apps TEXT NOT NULL,
  PRIMARY KEY (pid, week)
);
