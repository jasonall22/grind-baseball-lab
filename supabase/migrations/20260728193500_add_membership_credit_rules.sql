alter table public.booking_services
  add column if not exists membership_credit_rules jsonb not null default '[]'::jsonb;

alter table public.booking_customer_memberships
  add column if not exists credit_rules jsonb not null default '[]'::jsonb;

update public.booking_services
set membership_credit_rules =
  case
    when membership_credits_per_day > 0 and membership_credit_scope = 'all_services' then
      jsonb_build_array(
        jsonb_build_object(
          'id', 'legacy',
          'serviceIds', jsonb_build_array('all_services'),
          'credits', membership_credits_per_day,
          'period', coalesce(membership_credit_limit_period, 'day')
        )
      )
    when membership_credits_per_day > 0 and coalesce(array_length(membership_eligible_service_ids, 1), 0) > 0 then
      jsonb_build_array(
        jsonb_build_object(
          'id', 'legacy',
          'serviceIds', to_jsonb(membership_eligible_service_ids),
          'credits', membership_credits_per_day,
          'period', coalesce(membership_credit_limit_period, 'day')
        )
      )
    else '[]'::jsonb
  end
where service_type = 'memberships'
  and membership_credit_rules = '[]'::jsonb;

update public.booking_customer_memberships
set credit_rules =
  case
    when credits_per_day > 0 and credit_scope = 'all_services' then
      jsonb_build_array(
        jsonb_build_object(
          'id', 'legacy',
          'serviceIds', jsonb_build_array('all_services'),
          'credits', credits_per_day,
          'period', coalesce(credit_limit_period, 'day')
        )
      )
    when credits_per_day > 0 and coalesce(array_length(eligible_service_ids, 1), 0) > 0 then
      jsonb_build_array(
        jsonb_build_object(
          'id', 'legacy',
          'serviceIds', to_jsonb(eligible_service_ids),
          'credits', credits_per_day,
          'period', coalesce(credit_limit_period, 'day')
        )
      )
    else '[]'::jsonb
  end
where credit_rules = '[]'::jsonb;
