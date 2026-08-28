-- Manual control over which periods count toward the rate. The reading is
-- always kept and charted; this only removes the interval leading up to it.

alter table wk_measurements
  add column if not exists exclude_from_rate boolean not null default false;

comment on column wk_measurements.exclude_from_rate is
  'User asked for the interval ending at this reading to be left out of rate analysis. The reading itself is kept.';
