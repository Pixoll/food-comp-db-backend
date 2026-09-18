create table if not exists langual_code (
    id smallint unsigned primary key auto_increment,
    code char(5) unique not null check (code = upper(code) and length(code) = 5),
    descriptor varchar(150) not null check (descriptor != ''),
    parent_id smallint unsigned,
    foreign key (parent_id) references langual_code (id)
);

create table if not exists food_langual_code (
    food_id    bigint unsigned   not null,
    langual_id smallint unsigned not null,
    primary key (food_id, langual_id),
    foreign key (food_id) references food (id),
    foreign key (langual_id) references langual_code (id)
);