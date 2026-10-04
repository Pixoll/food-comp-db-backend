drop trigger if exists food_insert_check_trigger;

alter table food
    add column
        others varchar(300) null check (others is null or others != '') after observation;

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
