CREATE TABLE symbols (
  symbol TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  type TEXT,
  timezone TEXT,
  exchange TEXT,
  pricescale INTEGER,
  supported_resolutions TEXT[]
);

INSERT INTO symbols (symbol, name, description, type, timezone, exchange, pricescale, supported_resolutions)
VALUES ('SPY', 'SPDR S&P 500 ETF Trust', 'SPDR S&P 500 ETF Trust', 'stock', 'America/New_York', 'NYSE', 100, '{"1", "5", "15", "60", "1D", "1W"}');
