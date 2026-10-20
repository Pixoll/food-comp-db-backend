drop table if exists food_origin;
drop table if exists location;
drop table if exists commune;
drop table if exists province;
drop table if exists region;
drop table if exists origin;

drop trigger if exists location_insert_check_trigger;
drop trigger if exists commune_insert_check_trigger;
drop trigger if exists province_insert_check_trigger;
drop trigger if exists region_insert_check_trigger;
drop trigger if exists origin_insert_check_trigger;

create table if not exists origin (
    id   mediumint unsigned primary key auto_increment,
    type enum ('region', 'province', 'commune', 'location') not null,
    name varchar(64) not null check (name != '')
);

create trigger origin_insert_check_trigger
    before insert
    on origin
    for each row
begin
    declare already_exists boolean;

    set already_exists = (
        select true
        from origin as o
        where o.id = new.id and o.name like new.name);

    if already_exists then
        signal sqlstate '45000' set message_text = 'An origin with that same type and name already exists.';
    end if;
end;


create table if not exists region (
    id     mediumint unsigned primary key,
    number tinyint unsigned unique not null check (number > 0),
    place  tinyint unsigned unique not null check (place >= 0),
    foreign key (id) references origin (id)
);
create trigger region_insert_check_trigger
    before insert
    on region
    for each row
begin
    declare o_type varchar(8);
    declare msg varchar(64);

    set o_type = (
        select o.type
        from origin as o
        where o.id = new.id);

    if o_type != 'region' then
        set msg = concat('Origin type corresponds to a ', o_type, ', expected a region.');
        signal sqlstate '45000' set message_text = msg;
    end if;
end;

create table if not exists province (
    id        mediumint unsigned primary key,
    region_id mediumint unsigned not null,
    foreign key (id) references origin (id),
    foreign key (region_id) references region (id)
);

create trigger province_insert_check_trigger
    before insert
    on province
    for each row
begin
    declare o_type varchar(8);
    declare msg varchar(64);

    set o_type = (
        select o.type
        from origin as o
        where o.id = new.id);

    if o_type != 'province' then
        set msg = concat('Origin type corresponds to a ', o_type, ', expected a province.');
        signal sqlstate '45000' set message_text = msg;
    end if;
end;

create table if not exists commune (
    id          mediumint unsigned primary key,
    province_id mediumint unsigned not null,
    foreign key (id) references origin (id),
    foreign key (province_id) references province (id)
);

create trigger commune_insert_check_trigger
    before insert
    on commune
    for each row
begin
    declare o_type varchar(8);
    declare msg varchar(64);

    set o_type = (
        select o.type
        from origin as o
        where o.id = new.id);

    if o_type != 'commune' then
        set msg = concat('Origin type corresponds to a ', o_type, ', expected a commune.');
        signal sqlstate '45000' set message_text = msg;
    end if;
end;

create table if not exists location (
    id         mediumint unsigned primary key,
    type       enum ('city', 'town') not null,
    commune_id mediumint unsigned    not null,
    foreign key (id) references origin (id),
    foreign key (commune_id) references commune (id)
);

create trigger location_insert_check_trigger
    before insert
    on location
    for each row
begin
    declare o_type varchar(8);
    declare msg varchar(64);

    set o_type = (
        select o.type
        from origin as o
        where o.id = new.id);

    if o_type != 'location' then
        set msg = concat('Origin type corresponds to a ', o_type, ', expected a location.');
        signal sqlstate '45000' set message_text = msg;
    end if;
end;

-- Recreación de la tabla pivote food_origin
create table if not exists food_origin (
    food_id   bigint unsigned    not null,
    origin_id mediumint unsigned not null,
    primary key (food_id, origin_id),
    foreign key (food_id) references food (id),
    foreign key (origin_id) references origin (id)
);

update food
set others = left(others, 300)
where length(others) > 300;

alter table food modify column others varchar(300) null check (others is null or others != '');