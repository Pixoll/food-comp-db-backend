create table  if not exists ref_author (
                id int unsigned primary key auto_increment,
                name varchar(200) unique not null check (name != '')
    );

create table  if not exists ref_city (
              id int unsigned primary key auto_increment,
              name varchar(100) unique not null check (name != '')
    );

create table  if not exists journal (
             id int unsigned primary key auto_increment,
             name varchar(100) unique not null check (name != '')
    );

create table  if not exists journal_volume (
            id int unsigned primary key auto_increment,
            journal_id int unsigned not null,
            volume int unsigned not null,
            issue int unsigned not null,
            year smallint unsigned not null,

            foreign key (journal_id) references journal(id)
);

create table if not exists ref_article (
             id int unsigned primary key auto_increment,
             volume_id int unsigned not null,
             page_start smallint unsigned not null,
             page_end smallint unsigned not null,

             foreign key (volume_id) references journal_volume(id)
);

alter table  if not exists reference
    add column title varchar(300) null after code,
    add column type enum (
        'report',
        'thesis',
        'article',
        'website',
        'book'
    ) null after title,
    add column ref_article_id int unsigned unique null after type,
    add column ref_city_id int unsigned null after ref_article_id,
    add column year smallint unsigned null after ref_city_id,
    add column other varchar(100) null after year;

alter table reference
    add foreign key (ref_article_id)
        references ref_article(id),
    add foreign key (ref_city_id)
        references ref_city(id);

create table  if not exists reference_author (
                                  reference_code int unsigned not null,
                                  author_id int unsigned not null,

                                  primary key (reference_code, author_id),

                                  foreign key (reference_code) references reference(code),
                                  foreign key (author_id) references ref_author(id)
);

create trigger if not exists ref_author_insert_check_trigger
    before insert
    on ref_author
    for each row
begin
    declare already_exists boolean;
    declare msg varchar(64);

    set already_exists = (
        select true
        from ref_author as a
        where a.name like new.name
    );

    if already_exists then
        set msg = concat(
            'Reference author with name ',
            new.name,
            ' already exists.'
        );

        signal sqlstate '45000'
            set message_text = msg;
end if;
end;


create trigger if not exists ref_city_insert_check_trigger
    before insert
    on ref_city
    for each row
begin
    declare already_exists boolean;
    declare msg varchar(64);

    set already_exists = (
        select true
        from ref_city as c
        where c.name like new.name
    );

    if already_exists then
        set msg = concat(
            'Reference city with name ',
            new.name,
            ' already exists.'
        );

        signal sqlstate '45000'
            set message_text = msg;
end if;
end;


create trigger if not exists journal_insert_check_trigger
    before insert
    on journal
    for each row
begin
    declare already_exists boolean;
    declare msg varchar(64);

    set already_exists = (
        select true
        from journal as j
        where j.name like new.name
    );

    if already_exists then
        set msg = concat(
            'Journal with name ',
            new.name,
            ' already exists.'
        );

        signal sqlstate '45000'
            set message_text = msg;
end if;
end;


create trigger if not exists journal_volume_insert_check_trigger
    before insert
    on journal_volume
    for each row
begin
    declare already_exists boolean;

    set already_exists = (
        select true
        from journal_volume as v
        where v.journal_id = new.journal_id
          and v.volume = new.volume
          and v.issue = new.issue
          and v.year = new.year
    );

    if already_exists then
        signal sqlstate '45000'
            set message_text = 'Journal volume already exists.';
end if;
end;


create trigger if not exists ref_article_insert_check_trigger
    before insert
    on ref_article
    for each row
begin
    declare already_exists boolean;

    set already_exists = (
        select true
        from ref_article as ra
        where ra.volume_id = new.volume_id
          and ra.page_start = new.page_start
          and ra.page_end = new.page_end
    );

    if already_exists then
        signal sqlstate '45000'
            set message_text = 'Reference article already exists.';
end if;
end;


create trigger if not exists reference_insert_check_trigger
    before insert
    on reference
    for each row
begin
    if new.type = 'article'
        and new.ref_article_id is null then

        signal sqlstate '45000'
            set message_text =
                'ref_article_id must be specified if reference type is article.';
end if;

if new.type != 'article'
        and new.ref_article_id is not null then

        signal sqlstate '45000'
            set message_text =
                'ref_article_id should not be present if reference type is not article.';
end if;

    if new.type != 'website'
        and new.year is null
        and new.ref_article_id is null then

        signal sqlstate '45000'
            set message_text =
                'Reference year must be specified if ref_article_id is not present.';
end if;

    if new.type in ('website', 'book')
        and new.other is null then

        signal sqlstate '45000'
            set message_text =
                'Reference other column must be specified if the type is either website or book.';
end if;
end;
