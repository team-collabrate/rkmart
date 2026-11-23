-- The real product list (46 items) for a LIVE project. Run once, after the migrations:
--   psql <connection string> -f supabase/prod-catalog.sql    (or paste into the Supabase SQL editor)
--
-- HSN codes and GST rates here are SAMPLES: your accountant must confirm each one, and you can fix
-- them in the app (More > Items) before the first real bill. No rates are loaded: set the real rates
-- every morning in Rates. Shops are added in the app (More > Shops), not here.
-- Do NOT run supabase/seed.sql on a live project: it holds demo shops and demo rates.

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
