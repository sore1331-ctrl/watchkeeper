-- Judge each watch against its own movement tolerance, and record when the
-- wearer corrected the time so the resulting offset jump is never read as drift.

alter table wk_watches
  add column if not exists rate_spec_min numeric,
  add column if not exists rate_spec_max numeric,
  add column if not exists rate_spec_source text;

comment on column wk_watches.rate_spec_min is
  'Manufacturer daily rate tolerance, lower bound (s/day). e.g. Seiko 4R34 = -35';
comment on column wk_watches.rate_spec_max is
  'Manufacturer daily rate tolerance, upper bound (s/day). e.g. Seiko 4R34 = +45';

alter table wk_measurements
  add column if not exists time_adjusted boolean not null default false;

comment on column wk_measurements.time_adjusted is
  'The watch was reset or hand-corrected since the previous measurement, so no '
  'rate sample spans that gap — the offset jump is the correction, not drift.';
