update public.domain_definitions
set type_options = jsonb_build_array(
  jsonb_build_object(
    'id', 'street_signs_sign_type',
    'option_key', 'sign_type',
    'option_label', 'Sign Type',
    'choices', jsonb_build_array(
      jsonb_build_object('value', 'stop', 'label', 'Stop', 'sort_order', 10),
      jsonb_build_object('value', 'yield', 'label', 'Yield', 'sort_order', 20),
      jsonb_build_object('value', 'speed_limit', 'label', 'Speed Limit', 'sort_order', 30),
      jsonb_build_object('value', 'warning', 'label', 'Warning', 'sort_order', 40),
      jsonb_build_object('value', 'no_parking', 'label', 'No Parking', 'sort_order', 50),
      jsonb_build_object('value', 'one_way', 'label', 'One Way', 'sort_order', 60),
      jsonb_build_object('value', 'school_zone', 'label', 'School Zone', 'sort_order', 70),
      jsonb_build_object('value', 'crosswalk', 'label', 'Crosswalk', 'sort_order', 80),
      jsonb_build_object('value', 'street_name', 'label', 'Street Name', 'sort_order', 90),
      jsonb_build_object('value', 'other', 'label', 'Other', 'sort_order', 100)
    )
  )
)
where key = 'street_signs'
  and exists (
    select 1
    from jsonb_array_elements(coalesce(public.domain_definitions.type_options, '[]'::jsonb)) as option_row
    where coalesce(option_row ->> 'option_key', '') = 'sign_type'
      and coalesce(jsonb_array_length(coalesce(option_row -> 'choices', '[]'::jsonb)), 0) = 0
  );
