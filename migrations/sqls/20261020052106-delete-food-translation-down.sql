create table if not exists language (
                                        id   tinyint unsigned primary key auto_increment,
                                        code enum ('es', 'en', 'pt') unique not null,
    name varchar(32) unique             not null check (name != '')
    );

create trigger language_insert_check_trigger
    before insert
    on language
    for each row
begin
    declare already_exists boolean;
    declare msg varchar(64);

    set already_exists = (
        select true
        from language as l
        where lower(l.name) = lower(new.name));

    if already_exists then
        set msg = concat('Language with name ', new.name, ' already exists.');
        signal sqlstate '45000' set message_text = msg;
end if;
end;

insert ignore into language (id, code, name) values
(1, 'es', 'Spanish'),
(2, 'en', 'English'),
(3, 'pt', 'Portuguese');

create table if not exists food_translation (
                                                food_id     bigint unsigned  not null,
                                                language_id tinyint unsigned not null,
                                                common_name varchar(200),
    ingredients varchar(400),
    primary key (food_id, language_id),
    foreign key (food_id) references food (id),
    foreign key (language_id) references language (id)
    );

insert into food_translation (food_id, language_id, common_name)
select f.id, l.id, f.common_name
from food f
         inner join language l on l.code = 'es'
where f.common_name is not null and f.common_name != '';