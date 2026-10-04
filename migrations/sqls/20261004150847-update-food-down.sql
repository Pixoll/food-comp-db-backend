drop trigger if exists food_insert_check_trigger;
drop trigger if exists subspecies_insert_check_trigger;
drop trigger if exists food_type_insert_check_trigger;

create table if not exists food_type (
    id   tinyint unsigned primary key auto_increment,
    code char(1) unique     not null check (code = upper(code) and length(code) = 1),
    name varchar(64) unique not null check (name != '')
);

create trigger food_type_insert_check_trigger
    before insert
    on food_type
    for each row
begin
    declare already_exists boolean;
    declare msg varchar(64);

    set already_exists = (
        select true
        from food_type as t
        where t.name like new.name);

    if already_exists then
        set msg = concat('Food type ', new.name, ' already exists.');
        signal sqlstate '45000' set message_text = msg;
end if;
end;

create table if not exists subspecies (
    id   int unsigned primary key auto_increment,
    name varchar(64) unique not null check (name != '')
);

create trigger subspecies_insert_check_trigger
    before insert
    on subspecies
    for each row
begin
    declare already_exists boolean;
    declare msg varchar(64);

    set already_exists = (
        select true
        from subspecies sp
        where sp.name like new.name);

    if already_exists then
        set msg = concat('Subspecies with name ', new.name, ' already exists.');
        signal sqlstate '45000' set message_text = msg;
end if;
end;

alter table food
    add column type_id tinyint unsigned not null after group_id,
    add column subspecies_id int unsigned after scientific_name_id,
    add column strain varchar(50) check (strain is null or strain != '') after subspecies_id,
    add column brand varchar(8) check (brand is null or brand != '') after strain;

alter table food
    add constraint food_ibfk_2
        foreign key (type_id) references food_type (id),
    add constraint food_ibfk_4
        foreign key (subspecies_id) references subspecies (id);

create trigger food_insert_check_trigger
    before insert
    on food
    for each row
begin
    if new.subspecies_id is not null and new.scientific_name_id is null then
        signal sqlstate '45000'
            set message_text = 'Must specify scientific_name_id if subspecies_id is present.';
end if;
end;

alter table food
drop column others;