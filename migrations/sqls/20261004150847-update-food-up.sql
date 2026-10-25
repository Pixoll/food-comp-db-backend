drop trigger if exists food_insert_check_trigger;

alter table food
    add column
        others varchar(300) null check (others is null or others != '') after observation;

alter table food
    add column
        portion_quantity int unsigned null check (portion_quantity is null or portion_quantity > 0) after others;

alter table food
    add column
        food_name varchar(255) null check (food_name is null or food_name != '') after code;

alter table food
    add column
        common_name varchar(255) null check (common_name is null or common_name != '') after food_name;

update food
set food_name = coalesce(food_name, 'nombre comun'),
    common_name = coalesce(common_name, 'nombre comun')
where food_name is null or common_name is null;

update food
set others = concat_ws(' - ', nullif(trim(brand), ''), nullif(trim(others), ''))
where brand is not null and brand != '';

alter table food
drop foreign key food_ibfk_2,
    drop foreign key food_ibfk_4;

alter table food
drop column type_id,
    drop column subspecies_id,
    drop column strain,
    drop column brand;

drop table if exists subspecies;

drop table if exists food_type;