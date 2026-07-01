alter table public.booking_settings
add column if not exists waiver_enabled boolean not null default false,
add column if not exists waiver_document_url text,
add column if not exists waiver_document_name text,
add column if not exists waiver_intro text not null default 'By clicking Agree & Continue, you confirm that the customer has had the opportunity to review this waiver and has agreed to its terms with full consent.',
add column if not exists waiver_allow_in_person boolean not null default true;
