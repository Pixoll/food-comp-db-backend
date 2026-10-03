create table measurement_backup (
      id          bigint unsigned primary key,
      min         decimal(10, 5),
      max         decimal(10, 5),
      sample_size int,
      data_type   enum ('analytic', 'calculated', 'assumed', 'borrowed') not null
);

insert into measurement_backup (id, min, max, sample_size, data_type)
select id, min, max, sample_size, data_type
from measurement;

drop trigger measurement_insert_check_trigger;

alter table measurement
    drop column min,
    drop column max,
    drop column sample_size,
    drop column data_type;

alter table nutrient
    add column parent_id smallint unsigned null after id,
    add constraint nutrient_parent_fk foreign key (parent_id) references nutrient (id);

update nutrient as n
    join nutrient_component as nc on nc.id = n.id
set n.parent_id = nc.macronutrient_id;

update nutrient
set type = 'macronutrient'
where type = 'component';

alter table nutrient
    modify column type enum ('energy', 'macronutrient', 'micronutrient') not null;

drop trigger nutrient_component_insert_check_trigger;
drop table nutrient_component;
