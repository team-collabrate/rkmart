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
  ('Toor dal', 'துவரம் பருப்பு', 'Dals and pulses', 'kg', '0713', 0, 101),
  ('Moong dal', 'பாசிப்பருப்பு', 'Dals and pulses', 'kg', '0713', 0, 102),
  ('Mustard', 'கடுகு', 'Spices and masala', 'kg', '1207', 0, 303),
  ('Cumin', 'சீரகம்', 'Spices and masala', 'kg', '0909', 0, 304),
  ('Pepper', 'மிளகு', 'Spices and masala', 'kg', '0904', 0, 305),
  ('Fenugreek', 'வெந்தயம்', 'Spices and masala', 'kg', '0910', 0, 306),
  ('Bengal gram dal', 'கடலைப்பருப்பு', 'Dals and pulses', 'kg', '0713', 0, 107),
  ('Dry red chilli', 'வர மிளகாய்', 'Spices and masala', 'kg', '0904', 0, 308),
  ('Chilli powder', 'மிளகாய்த்தூள்', 'Spices and masala', 'kg', '0904', 0, 309),
  ('Coriander powder', 'மல்லித்தூள்', 'Spices and masala', 'kg', '0909', 0, 310),
  ('Sambar powder', 'சாம்பார் பொடி', 'Spices and masala', 'kg', '0910', 5, 311),
  ('Turmeric powder', 'மஞ்சள்தூள்', 'Spices and masala', 'kg', '0910', 0, 312),
  ('Chicken podi', 'சிக்கன் பொடி', 'Spices and masala', 'kg', '0910', 5, 313),
  ('Mutton masala', 'மட்டன் மசாலா', 'Spices and masala', 'kg', '0910', 5, 314),
  ('Sago', 'ஜவ்வரிசி', 'Snacks and others', 'kg', '1903', 5, 715),
  ('Vermicelli', 'சேமியா', 'Snacks and others', 'kg', '1902', 5, 716),
  ('Cashew', 'முந்திரி', 'Dry fruits', 'kg', '0801', 5, 617),
  ('Raisins', 'திராட்சை', 'Dry fruits', 'kg', '0806', 5, 618),
  ('Cardamom', 'ஏலக்காய்', 'Spices and masala', 'kg', '0908', 5, 319),
  ('Rava', 'ரவை', 'Rice and flour', 'kg', '1103', 5, 220),
  ('Gold Winner oil', 'கோல்டு வின்னர் எண்ணெய்', 'Oil and ghee', 'litre', '1512', 5, 421),
  ('Dalda', 'டால்டா', 'Oil and ghee', 'kg', '1516', 12, 422),
  ('Ghee', 'நெய்', 'Oil and ghee', 'kg', '0405', 12, 423),
  ('Sappatu rice', 'சாப்பாட்டு அரிசி', 'Rice and flour', 'bag', '1006', 5, 224),
  ('Pongal rice', 'பொங்கல் அரிசி', 'Rice and flour', 'bag', '1006', 5, 225),
  ('Biryani rice', 'பிரியாணி அரிசி', 'Rice and flour', 'kg', '1006', 5, 226),
  ('Sesame oil', 'நல்லெண்ணெய்', 'Oil and ghee', 'litre', '1515', 5, 427),
  ('Sugar', 'சீனி', 'Sugar and sweets', 'kg', '1701', 5, 528),
  ('Tamarind', 'புளி', 'Spices and masala', 'kg', '0813', 0, 329),
  ('Appalam', 'அப்பளம்', 'Snacks and others', 'kg', '1905', 5, 730),
  ('Green peas', 'பச்சைப்பட்டாணி', 'Dals and pulses', 'kg', '0713', 0, 131),
  ('Asafoetida powder', 'பெருங்காயத்தூள்', 'Spices and masala', 'kg', '0910', 5, 332),
  ('Pori kadalai', 'பொரிகடலை', 'Snacks and others', 'kg', '2008', 5, 733),
  ('Oil (kind not named)', 'எண்ணெய்', 'Oil and ghee', 'litre', '1512', 5, 434),
  ('Tea cup', 'டீ கப்', 'Snacks and others', 'dozen', '3924', 18, 735),
  ('Urad dal', 'உளுந்து', 'Dals and pulses', 'kg', '0713', 0, 136),
  ('Pattani paruppu', 'பட்டாணிப்பருப்பு', 'Dals and pulses', 'kg', '0713', 0, 137),
  ('Rice flour', 'அரிசிமாவு', 'Rice and flour', 'kg', '1102', 0, 238),
  ('Maida', 'மைதா', 'Rice and flour', 'kg', '1101', 0, 239),
  ('Tutti frutti', 'ஃப்ரூட்', 'Dry fruits', 'kg', '2006', 12, 640),
  ('Mochai', 'மொச்சை', 'Dals and pulses', 'kg', '0713', 0, 141),
  ('Gram flour', 'கடலைமாவு', 'Rice and flour', 'kg', '1106', 0, 242),
  ('Green gram', 'பச்சைப்பயறு', 'Dals and pulses', 'kg', '0713', 0, 143),
  ('Jaggery', 'நாட்டுச் சர்க்கரை', 'Sugar and sweets', 'kg', '1701', 0, 544),
  ('Wheat flour', 'கோதுமை மாவு', 'Rice and flour', 'kg', '1101', 0, 245),
  ('Salt', 'உப்பு', 'Snacks and others', 'kg', '2501', 0, 746);

-- The unnamed "Oil" line of the handwritten list is switched off until the owner says which oil it is.
update public.products set is_active = false where name_en = 'Oil (kind not named)';

-- Today's DEMO rates (before GST). RK sets the real rates every day.
insert into public.daily_rates (product_id, rate_date, rate)
select p.id, current_date, r.rate
from public.products p
join (values
  ('Toor dal', 150.00),
  ('Moong dal', 130.00),
  ('Mustard', 95.00),
  ('Cumin', 420.00),
  ('Pepper', 720.00),
  ('Fenugreek', 110.00),
  ('Bengal gram dal', 95.00),
  ('Dry red chilli', 260.00),
  ('Chilli powder', 300.00),
  ('Coriander powder', 200.00),
  ('Sambar powder', 320.00),
  ('Turmeric powder', 190.00),
  ('Chicken podi', 520.00),
  ('Mutton masala', 540.00),
  ('Sago', 75.00),
  ('Vermicelli', 70.00),
  ('Cashew', 780.00),
  ('Raisins', 360.00),
  ('Cardamom', 2400.00),
  ('Rava', 58.00),
  ('Gold Winner oil', 135.00),
  ('Dalda', 125.00),
  ('Ghee', 620.00),
  ('Sappatu rice', 1350.00),
  ('Pongal rice', 1280.00),
  ('Biryani rice', 120.00),
  ('Sesame oil', 420.00),
  ('Sugar', 46.00),
  ('Tamarind', 210.00),
  ('Appalam', 260.00),
  ('Green peas', 110.00),
  ('Asafoetida powder', 1800.00),
  ('Pori kadalai', 95.00),
  ('Oil (kind not named)', 135.00),
  ('Tea cup', 180.00),
  ('Urad dal', 140.00),
  ('Pattani paruppu', 95.00),
  ('Rice flour', 58.00),
  ('Maida', 44.00),
  ('Tutti frutti', 220.00),
  ('Mochai', 150.00),
  ('Gram flour', 95.00),
  ('Green gram', 120.00),
  ('Jaggery', 62.00),
  ('Wheat flour', 44.00),
  ('Salt', 22.00)
) as r (name_en, rate) on r.name_en = p.name_en;

-- Rates for the last six days, drifting a little each day, so Rates can show yesterday's price
-- and the order history has something to refer to.
insert into public.daily_rates (product_id, rate_date, rate)
select dr.product_id, current_date - d.n, round(dr.rate * (1 - d.n * 0.004 * (1 + (p.sort_order / 10) % 3 - 1)), 2)
from public.daily_rates dr
join public.products p on p.id = dr.product_id
cross join generate_series(1, 6) as d (n)
where dr.rate_date = current_date;
