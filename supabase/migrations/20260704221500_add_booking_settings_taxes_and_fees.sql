alter table public.booking_settings
add column if not exists tax_rates jsonb not null default '[]'::jsonb,
add column if not exists custom_fees jsonb not null default '[]'::jsonb;

update public.booking_settings
set
  tax_rates = case
    when jsonb_typeof(tax_rates) = 'array' and jsonb_array_length(tax_rates) > 0 then tax_rates
    else jsonb_build_array(
      jsonb_build_object(
        'id', 'tax-state',
        'name', 'State Tax',
        'percentage', '7',
        'taxId', ''
      )
    )
  end,
  custom_fees = case
    when jsonb_typeof(custom_fees) = 'array' and jsonb_array_length(custom_fees) > 0 then custom_fees
    else jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-service',
        'name', 'Service Fee',
        'amount', '3.5'
      )
    )
  end
where key = 'default';
