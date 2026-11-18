# Stage 6: the day's bills as one PDF

Status: built and tested on the demo backend and in the database tests. The PDF was rendered and checked by eye (English and Tamil). The Supabase storage and archive code is written but not yet run, because no Supabase project exists yet. The Android share sheet is built but not yet tried on a phone.

## What the admin can do now

Screen: **Bills** (`/admin/bills`).

- Day arrows (back to any earlier day, not past today) and the list of that day's issued bills: shop, bill number, amount, and which saved PDF holds it ("In PDF v1" or "Not in a PDF yet"). Tap a bill to open it.
- **Make PDF of all bills**: one PDF, two bills per A4 page, English and Tamil item names, dashed cut line in the middle. It is saved with a version number, then offered to **Print** and **Download**.
- If a bill is made after a PDF, a second button, **Make PDF of only the new bills**, makes a small add-on PDF (version 2, 3, ...). "Make PDF of all bills again" is always there.
- **Saved PDFs** list: every version of that day, with Print and Download. Old days work the same.
- Browser: Download saves the file; Print opens the PDF in a new tab (use its print button). Android app: both open the phone's share sheet, so the PDF can go to a print app, the PDF viewer, or WhatsApp.
- A warning shows while the company GSTIN is empty in Settings.

## The page layout

- A4 portrait. Top and bottom bill each get half a page. An odd last bill leaves its bottom half blank.
- A bill that does not fit half a page (more than 9 item lines, or long names that wrap) gets a page of its own, and continues on the next page if it is very long. Bills stay in invoice order: a long bill ends the current pair, and the next short bill starts a new pair.
- Item rows show the English name in bold and the Tamil name after it on the same line, so more items fit than with two lines per item.
- CGST and SGST for a shop in the same state, IGST for another state. A small note says whether rates are before or after GST. Company bank details print under the amount in words when filled in Settings.
- Amount in words is for the invoice total (the legal amount of that bill). The "Total due" row adds the previous balance.
- Margins: 22 pt at the top, 14 pt (about 5 mm) at the bottom, 28 pt at the sides.
- "Delivered by" prints only when a name is known. Distributors are assigned in Stage 7, so it is left out for now. The bill has a signature line for the distributor.

How the 9-line limit was found: rendered real bills with 7, 8, 9 and 10 lines and looked at where the signature line landed. At 10 lines the bottom bill's signature row fell off the page, so the limit is 9 with a small safety margin. If RK's real orders usually have more lines, the bill can be tightened (smaller type or tighter rows), which needs a re-check on paper.

## Saving and numbering (database)

Migration `20261120100000_daily_pdfs.sql`:

- `record_daily_pdf(date, path, invoice_ids)`: admin only. Takes the next version number for that day (two exports at the same moment cannot take the same number), remembers which bills the PDF holds, writes an audit record. Refuses an empty list, a blank path, and a bill that does not exist or is cancelled.
- The app cannot write the `daily_bill_pdfs` table directly.
- A private storage bucket `daily-bills` (PDF files only, 10 MB limit) with admin-only read and write rules. It is created only on a real Supabase project, because the test database has no storage.

## How it is built

- `lib/pdf/dailyBillsDoc.ts`: the bill layout. `lib/pdf/layout.ts`: what fits on half a page and the page plan. `lib/pdf/billMapper.ts`: saved invoice to printable bill. `lib/pdf/makeDayPdf.ts`: makes the PDF; loaded only when a PDF is wanted, so the PDF library and fonts do not slow down normal use.
- `lib/files.ts`: browser download or Android share sheet (`@capacitor/filesystem` and `@capacitor/share`, new in this stage).
- `data/adminApi.ts`: `listDayInvoices`, `listDayPdfs`, `saveDayPdf`, `getDayPdf`, with a demo version (file kept in memory) and a Supabase version (file in the bucket, record through `record_daily_pdf`).
- `features/admin/BillsPage.tsx`, `DayNav.tsx` (shared with the Orders screen). Text: `admin.bills.*` in `i18n/admin.en.json` and `admin.ta.json`.

## Tests

- Database: 5 archive tests (versions, bills remembered, audit, who may call it, bad input, direct writes refused). 87 database tests in total.
- Web: page planning and layout rules, the document contents (IGST, notes, optional lines), a real PDF made in Node with the app's fonts, the demo archive, and the Bills screen (make, print, download, add-on version, saved list, previous day, Tamil).
- Sample PDFs for checking by eye: open `/spikes/pdf` in a demo or spikes build.

## To check with RK

- Print one sample page on RK's real printer and cut it: do the margins, the cut line and the type size work on paper?
- Typical number of item lines on a bill. If it is often above 9, we tighten the layout.
- USB printer on a laptop, or WiFi printer from a phone? This decides how the PDF is printed in practice.
- Should the PDF also list the distributor's name on each bill? That needs the delivery assignment from Stage 7.

## Not in this stage

- Marking bills delivered, collecting the signed copy, payments (Stage 7).
- Alerts (Stage 8) and reports (Stage 9).
