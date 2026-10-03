-- Whether the reference time of a reading was checked against a time server
-- (and corrected) when it was taken. Checked readings carry a much smaller
-- reference error, which the rate uncertainty takes into account.

alter table wk_measurements
  add column if not exists reference_checked boolean not null default false;

comment on column wk_measurements.reference_checked is
  'The device clock was compared with the server clock and corrected when this reading was taken.';
