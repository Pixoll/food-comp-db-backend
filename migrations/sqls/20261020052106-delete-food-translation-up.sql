update food f
    inner join food_translation ft on f.id = ft.food_id
    inner join language l on ft.language_id = l.id
    set f.common_name = nullif(trim(ft.common_name), '')
where l.code = 'es';

drop table if exists food_translation;

drop trigger if exists language_insert_check_trigger;

drop table if exists language;