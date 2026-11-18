-- Sample data for a development database (loaded by `supabase db reset`, or paste into the
-- SQL editor of a DEV project). Never load this into production.
--
-- HSN codes and GST rates below are SAMPLES to make the app testable. RK's accountant must
-- confirm the real values before any real bill is issued.
--
-- Logins are not created here: use scripts/bootstrap-admin.mjs and scripts/seed-demo-users.mjs.

update public.settings
set company_name = 'RK Agency',
    tagline = 'Wholesale grocery distributor',
    address = 'Sample address, Tamil Nadu',
    phone = '9000000000',
    state_code = '33',
    invoice_prefix = 'RK',
    rates_include_gst = false;

insert into public.shops (name_en, name_ta, owner_name, phone, address, state_code) values
  ('Sri Murugan Cafe',   '',  'Murugan',  '9100000001', 'Town Hall',      '33'),
  ('Lakshmi Stores',     '',   'Lakshmi',  '9100000002', 'Gandhi Road',    '33'),
  ('Annam Hotel',        '',     'Annam',    '9100000003', 'Market Street',  '33'),
  ('Kavi Tiffin Centre', '',  'Kavi',     '9100000004', 'Bus Stand',      '33'),
  ('Green Leaf',         '',        'Gopal',    '9100000005', 'Station Road',   '33'),
  ('Saravana Bhavan',    '',         'Saravanan','9100000006', 'Temple Street',  '33'),
  ('Fresh Bites',        '',     'Priya',    '9100000007', 'College Road',   '33');

insert into public.products (name_en, name_ta, category, unit, hsn_code, gst_rate, sort_order) values
  ('Ponni rice',      'பொன்னி அரிசி',          'Rice and flour', 'bag', '1006', 5, 10),
  ('Idli rice',       'இட்லி அரிசி',           'Rice and flour', 'bag', '1006', 5, 20),
  ('Rava',            'ரவை',                  'Rice and flour', 'kg',  '1103', 5, 30),
  ('Wheat flour',     'கோதுமை மாவு',          'Rice and flour', 'kg',  '1101', 0, 40),
  ('Toor dal',        'துவரம் பருப்பு',        'Pulses',         'kg',  '0713', 0, 50),
  ('Urad dal',        'உளுந்தம் பருப்பு',      'Pulses',         'kg',  '0713', 0, 60),
  ('Sugar',           'சர்க்கரை',              'Staples',        'kg',  '1701', 5, 70),
  ('Salt',            'உப்பு',                'Staples',        'kg',  '2501', 0, 80),
  ('Tea powder',      'டீ தூள்',               'Staples',        'kg',  '0902', 5, 90),
  ('Sunflower oil',   'சூரியகாந்தி எண்ணெய்',   'Oil',            'can', '1512', 5, 100),
  ('Groundnut oil',   'கடலை எண்ணெய்',          'Oil',            'can', '1508', 5, 110),
  ('Tamarind',        'புளி',                  'Spices',         'kg',  '0813', 0, 120),
  ('Red chilli',      'மிளகாய் வற்றல்',        'Spices',         'kg',  '0904', 0, 130),
  ('Coriander seeds', 'மல்லி',                 'Spices',         'kg',  '0909', 0, 140),
  ('Turmeric powder', 'மஞ்சள் தூள்',           'Spices',         'kg',  '0910', 0, 150),
  ('Jaggery',         'வெல்லம்',               'Staples',        'kg',  '1701', 0, 160),
  ('Coconut oil',     'தேங்காய் எண்ணெய்',      'Oil',            'can', '1513', 5, 170),
  ('Black pepper',    'மிளகு',                 'Spices',         'kg',  '0904', 0, 180),
  ('Cumin',           'சீரகம்',                'Spices',         'kg',  '0909', 0, 190);

-- Today's sample rates (before GST).
insert into public.daily_rates (product_id, rate_date, rate)
select p.id, current_date, r.rate
from public.products p
join (values
  ('Ponni rice', 1350.00), ('Idli rice', 1280.00), ('Rava', 58.00), ('Wheat flour', 44.00),
  ('Toor dal', 140.00), ('Urad dal', 120.00), ('Sugar', 46.00), ('Salt', 22.00),
  ('Tea powder', 380.00), ('Sunflower oil', 780.00), ('Groundnut oil', 1850.00),
  ('Tamarind', 210.00), ('Red chilli', 260.00), ('Coriander seeds', 130.00), ('Turmeric powder', 190.00)
) as r (name_en, rate) on r.name_en = p.name_en;

-- New items: today's rates.
insert into public.daily_rates (product_id, rate_date, rate)
select p.id, current_date, r.rate
from public.products p
join (values ('Jaggery', 62.00), ('Coconut oil', 2100.00), ('Black pepper', 720.00), ('Cumin', 410.00))
  as r (name_en, rate) on r.name_en = p.name_en;

-- Rates for the last six days, drifting a little each day, so Rates can show yesterday's price
-- and the order history has something to refer to.
insert into public.daily_rates (product_id, rate_date, rate)
select dr.product_id, current_date - d.n, round(dr.rate * (1 - d.n * 0.004 * (1 + (p.sort_order / 10) % 3 - 1)), 2)
from public.daily_rates dr
join public.products p on p.id = dr.product_id
cross join generate_series(1, 6) as d (n)
where dr.rate_date = current_date;
