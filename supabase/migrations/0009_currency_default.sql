-- One default currency. The app always sends a currency, so these defaults
-- are never used in practice; they just should not disagree with each other
-- (watches and services said EUR, the wishlist and the app say GBP).

alter table wk_watches alter column currency set default 'GBP';
alter table wk_services alter column currency set default 'GBP';
