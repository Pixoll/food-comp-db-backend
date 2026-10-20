alter table food modify column others varchar(1000) null check (others is null or others != '');

update food f inner join (
    select
    fo.food_id,
    group_concat(
        concat_ws(', ',
            loc_o.name,
            com_o.name,
            prov_o.name,
            reg_o.name,
            if(r.id is not null or loc.id is not null or com.id is not null or prov.id is not null, 'Chile', o.name)
        )
        order by o.id
        separator ', '
    ) as origins_text
    from food_origin fo
    inner join origin o on o.id = fo.origin_id
    left join location loc on loc.id = o.id
    left join commune com on com.id = coalesce(o.id, loc.commune_id)
    left join province prov on prov.id = coalesce(o.id, com.province_id)
    left join region r on r.id = coalesce(o.id, prov.region_id)
    left join origin loc_o on loc_o.id = loc.id
    left join origin com_o on com_o.id = com.id
    left join origin prov_o on prov_o.id = prov.id
    left join origin reg_o on reg_o.id = r.id
    group by fo.food_id
) mapped_origins on mapped_origins.food_id = f.id set f.others = concat_ws(', ', nullif(trim(f.others), ''), mapped_origins.origins_text);

drop trigger if exists location_insert_check_trigger;
drop trigger if exists commune_insert_check_trigger;
drop trigger if exists province_insert_check_trigger;
drop trigger if exists region_insert_check_trigger;
drop trigger if exists origin_insert_check_trigger;

drop table if exists food_origin;
drop table if exists location;
drop table if exists commune;
drop table if exists province;
drop table if exists region;
drop table if exists origin;
