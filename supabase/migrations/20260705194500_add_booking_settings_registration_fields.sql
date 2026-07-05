alter table public.booking_settings
add column if not exists registration_personal_fields jsonb not null default '{}'::jsonb,
add column if not exists registration_contact_fields jsonb not null default '{}'::jsonb,
add column if not exists registration_additional_fields jsonb not null default '[]'::jsonb;

update public.booking_settings
set
  registration_personal_fields = case
    when jsonb_typeof(registration_personal_fields) = 'object' and registration_personal_fields <> '{}'::jsonb then registration_personal_fields
    else jsonb_build_object(
      'name', jsonb_build_object('required', true, 'hidden', false),
      'gender', jsonb_build_object('required', true, 'hidden', false),
      'dateOfBirth', jsonb_build_object('required', true, 'hidden', false)
    )
  end,
  registration_contact_fields = case
    when jsonb_typeof(registration_contact_fields) = 'object' and registration_contact_fields <> '{}'::jsonb then registration_contact_fields
    else jsonb_build_object(
      'address', jsonb_build_object('required', true, 'hidden', false),
      'phoneNumber', jsonb_build_object('required', true, 'hidden', false)
    )
  end,
  registration_additional_fields = case
    when jsonb_typeof(registration_additional_fields) = 'array' and jsonb_array_length(registration_additional_fields) > 0 then registration_additional_fields
    else jsonb_build_array(
      jsonb_build_object('id', 'registration-organization', 'label', 'Organization', 'type', 'Short Text', 'required', false),
      jsonb_build_object('id', 'registration-referral', 'label', 'Referral', 'type', 'Single-select', 'required', false),
      jsonb_build_object('id', 'registration-shirt-size', 'label', 'Shirt Size', 'type', 'Single-select', 'required', false)
    )
  end
where key = 'default';
