alter table public.booking_staff_members
add column if not exists calendar_color text not null default '#249b41';

update public.booking_staff_members
set calendar_color = case
  when sort_order = 1 then '#249b41'
  when sort_order = 2 then '#e46d32'
  when sort_order = 3 then '#e89bef'
  when sort_order = 4 then '#35d75b'
  when sort_order = 5 then '#1688d1'
  when sort_order = 6 then '#7c3aed'
  else '#249b41'
end
where calendar_color is null or calendar_color = '#249b41';
