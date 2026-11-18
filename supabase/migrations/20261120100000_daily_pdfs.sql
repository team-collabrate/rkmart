-- Stage 6: archive of the day's bill PDFs.
-- The PDF file goes into a private storage bucket (admin only). This function records it in
-- daily_bill_pdfs, takes the next version number for that day, and remembers which bills it holds,
-- so "only the new bills" can be printed later when an order is billed after the first PDF.

alter table public.daily_bill_pdfs
  add column invoice_ids uuid[] not null default '{}';

create or replace function public.record_daily_pdf(
  p_date date,
  p_path text,
  p_invoice_ids uuid[]
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  if (select public.app_role()) is distinct from 'admin' then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  if p_path is null or length(trim(p_path)) = 0 or coalesce(array_length(p_invoice_ids, 1), 0) = 0 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(p_invoice_ids) as x(id)
    where not exists (select 1 from public.invoices i where i.id = x.id and i.status = 'issued')
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  -- One at a time per day, so two exports cannot take the same version.
  perform pg_advisory_xact_lock(hashtext('daily_bill_pdfs:' || p_date::text));

  select coalesce(max(version), 0) + 1 into v_version
  from public.daily_bill_pdfs where bill_date = p_date;

  insert into public.daily_bill_pdfs (bill_date, version, file_path, bill_count, invoice_ids, created_by)
  values (p_date, v_version, p_path, array_length(p_invoice_ids, 1), p_invoice_ids, (select auth.uid()));

  perform public.write_audit('pdf.export', 'daily_bill_pdf', null,
    jsonb_build_object('date', p_date, 'version', v_version, 'bills', array_length(p_invoice_ids, 1)));

  return v_version;
end;
$$;

revoke all on function public.record_daily_pdf(date, text, uuid[]) from public;
grant execute on function public.record_daily_pdf(date, text, uuid[]) to authenticated;

-- The private bucket and its rules exist only on a real Supabase project (the test database has no
-- storage schema), so this part is skipped where storage is missing.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('daily-bills', 'daily-bills', false, 10485760, array['application/pdf'])
    on conflict (id) do nothing;

    execute $p$
      create policy daily_bills_admin_read on storage.objects for select to authenticated
      using (bucket_id = 'daily-bills' and (select public.app_role()) = 'admin')
    $p$;
    execute $p$
      create policy daily_bills_admin_write on storage.objects for insert to authenticated
      with check (bucket_id = 'daily-bills' and (select public.app_role()) = 'admin')
    $p$;
  end if;
end
$$;
