-- Stage 1 / 1 of 5: enumerated types.

create type public.user_role as enum ('admin', 'distributor', 'shop');
create type public.order_status as enum ('placed', 'billed', 'delivered', 'cancelled');
create type public.invoice_status as enum ('issued', 'cancelled');
create type public.payment_method as enum ('cash', 'upi', 'bank', 'other');
