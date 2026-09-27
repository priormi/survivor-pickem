insert into leagues (name, slug, timezone)
values ('Prior Family Survivor', 'prior-family', 'America/Chicago')
on conflict (slug) do update set
  name = excluded.name,
  timezone = excluded.timezone;

insert into teams (abbreviation, city, name, conference, division)
values
  ('ARI', 'Arizona', 'Cardinals', 'NFC', 'NFC West'),
  ('ATL', 'Atlanta', 'Falcons', 'NFC', 'NFC South'),
  ('BAL', 'Baltimore', 'Ravens', 'AFC', 'AFC North'),
  ('BUF', 'Buffalo', 'Bills', 'AFC', 'AFC East'),
  ('CAR', 'Carolina', 'Panthers', 'NFC', 'NFC South'),
  ('CHI', 'Chicago', 'Bears', 'NFC', 'NFC North'),
  ('CIN', 'Cincinnati', 'Bengals', 'AFC', 'AFC North'),
  ('CLE', 'Cleveland', 'Browns', 'AFC', 'AFC North'),
  ('DAL', 'Dallas', 'Cowboys', 'NFC', 'NFC East'),
  ('DEN', 'Denver', 'Broncos', 'AFC', 'AFC West'),
  ('DET', 'Detroit', 'Lions', 'NFC', 'NFC North'),
  ('GB', 'Green Bay', 'Packers', 'NFC', 'NFC North'),
  ('HOU', 'Houston', 'Texans', 'AFC', 'AFC South'),
  ('IND', 'Indianapolis', 'Colts', 'AFC', 'AFC South'),
  ('JAX', 'Jacksonville', 'Jaguars', 'AFC', 'AFC South'),
  ('KC', 'Kansas City', 'Chiefs', 'AFC', 'AFC West'),
  ('LV', 'Las Vegas', 'Raiders', 'AFC', 'AFC West'),
  ('LAC', 'Los Angeles', 'Chargers', 'AFC', 'AFC West'),
  ('LAR', 'Los Angeles', 'Rams', 'NFC', 'NFC West'),
  ('MIA', 'Miami', 'Dolphins', 'AFC', 'AFC East'),
  ('MIN', 'Minnesota', 'Vikings', 'NFC', 'NFC North'),
  ('NE', 'New England', 'Patriots', 'AFC', 'AFC East'),
  ('NO', 'New Orleans', 'Saints', 'NFC', 'NFC South'),
  ('NYG', 'New York', 'Giants', 'NFC', 'NFC East'),
  ('NYJ', 'New York', 'Jets', 'AFC', 'AFC East'),
  ('PHI', 'Philadelphia', 'Eagles', 'NFC', 'NFC East'),
  ('PIT', 'Pittsburgh', 'Steelers', 'AFC', 'AFC North'),
  ('SF', 'San Francisco', '49ers', 'NFC', 'NFC West'),
  ('SEA', 'Seattle', 'Seahawks', 'NFC', 'NFC West'),
  ('TB', 'Tampa Bay', 'Buccaneers', 'NFC', 'NFC South'),
  ('TEN', 'Tennessee', 'Titans', 'AFC', 'AFC South'),
  ('WAS', 'Washington', 'Commanders', 'NFC', 'NFC East')
on conflict (abbreviation) do update set
  city = excluded.city,
  name = excluded.name,
  conference = excluded.conference,
  division = excluded.division,
  active = true;

with league as (
  select id from leagues where slug = 'prior-family'
), seeded_players as (
  select league.id as league_id, seed.display_name, seed.pin, seed.is_admin
  from league
  cross join (values
    ('Mike', '1234', true),
    ('Heather', '2222', false),
    ('Chloe', '3333', false),
    ('Sophia', '4444', false)
  ) as seed(display_name, pin, is_admin)
)
insert into players (league_id, display_name, pin_hash, is_admin)
select seeded_players.league_id, seeded_players.display_name, extensions.crypt(seeded_players.pin, extensions.gen_salt('bf')), seeded_players.is_admin
from seeded_players
where not exists (
  select 1
  from players
  where players.league_id = seeded_players.league_id
    and lower(players.display_name) = lower(seeded_players.display_name)
    and players.active = true
);

with league as (
  select id from leagues where slug = 'prior-family'
)
insert into seasons (league_id, year, name, status)
select id, 2026, '2026 NFL Survivor', 'ACTIVE'
from league
on conflict (league_id, year) do update set
  name = excluded.name,
  status = excluded.status;

with season as (
  select s.id
  from seasons s
  join leagues l on l.id = s.league_id
  where l.slug = 'prior-family' and s.year = 2026
), current_round as (
  insert into rounds (season_id, sequence_number, round_code, round_type, display_name, deadline_at, status)
  select id, 1, 'WEEK_1', 'REGULAR', 'Week 1', '2026-12-31T18:00:00Z', 'OPEN'
  from season
  on conflict (season_id, round_code) do update set
    deadline_at = excluded.deadline_at,
    status = excluded.status
  returning id, season_id
)
update seasons s
set current_round_id = current_round.id
from current_round
where s.id = current_round.season_id;

with season as (
  select s.id as season_id, l.id as league_id
  from seasons s
  join leagues l on l.id = s.league_id
  where l.slug = 'prior-family' and s.year = 2026
)
insert into season_players (season_id, player_id, strike_count, status)
select season.season_id, players.id, 0, 'ACTIVE'
from season
join players on players.league_id = season.league_id and players.active = true
on conflict (season_id, player_id) do nothing;
