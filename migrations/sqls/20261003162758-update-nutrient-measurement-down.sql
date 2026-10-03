alter table nutrient
    modify column type enum ('energy', 'macronutrient', 'component', 'micronutrient') not null;

create table nutrient_component (
                                    id               smallint unsigned primary key,
                                    macronutrient_id smallint unsigned not null,
                                    foreign key (id) references nutrient (id),
                                    foreign key (macronutrient_id) references nutrient (id)
);

insert into nutrient_component (id, macronutrient_id)
select n.id, n.parent_id
from nutrient as n
         join nutrient as p on p.id = n.parent_id
where n.type = 'macronutrient'
  and p.type = 'macronutrient'
  and p.parent_id is null;

update nutrient as n
    join nutrient_component as nc on nc.id = n.id
    set n.type = 'component';

create trigger nutrient_component_insert_check_trigger
    before insert
    on nutrient_component
    for each row
begin
    declare n_type varchar(13);
    declare mn_type varchar(13);
    declare msg varchar(74);

    set n_type = (
        select n.type
        from nutrient as n
        where n.id = new.id);

    if n_type != 'component' then
        set msg = concat('Nutrient type corresponds to a ', n_type, ', expected a component.');
        signal sqlstate '45000' set message_text = msg;
end if;

set mn_type = (
        select n.type
        from nutrient as n
        where n.id = new.macronutrient_id);

    if mn_type != 'macronutrient' then
        set msg = concat('Nutrient type corresponds to a ', mn_type, ', expected a macronutrient.');
        signal sqlstate '45000' set message_text = msg;
end if;
end;

alter table nutrient
drop foreign key nutrient_parent_fk,
    drop column parent_id;

alter table measurement
    add column min         decimal(10, 5) check (min is null or min >= 0) after deviation,
    add column max         decimal(10, 5) check (max is null or max >= 0) after min,
    add column sample_size int check (sample_size is null or sample_size > 0) after max,
    add column data_type   enum ('analytic', 'calculated', 'assumed', 'borrowed') not null after sample_size;

update measurement as m
    join bak_measurement_20261003 as b on b.id = m.id
    set m.min         = b.min,
        m.max         = b.max,
        m.sample_size = b.sample_size,
        m.data_type   = b.data_type;

drop table bak_measurement_20261003;

create trigger measurement_insert_check_trigger
    before insert
    on measurement
    for each row
begin
    --  if new.sample_size is null and new.data_type = 'analytic' then
    --      signal sqlstate '45000'
    --          set message_text = 'Measurement sample_size must be provided if data_type is analytic';
    --  end if;

    if new.min > new.max then
        signal sqlstate '45000'
            set message_text = 'Measurement min can\'t be greater than max';
    end if;
end;
