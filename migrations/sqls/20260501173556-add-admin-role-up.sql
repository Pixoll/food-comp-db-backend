alter table db_admin
    add column
        id int unsigned not null auto_increment unique first;

alter table db_admin
    drop primary key,
    add unique key (username);

alter table db_admin
    add primary key (id);

alter table db_admin
    add column
        role enum ('admin', 'super') not null default 'admin' after username;

update db_admin
set
    role = 'super'
where username = 'root';

create procedure temp_rename_root()
begin
    declare v_new_name varchar(32) default 'root_admin';
    declare v_counter int default 1;

    if exists (
        select 1
        from db_admin
        where username = 'root') then

        while exists (
            select 1
            from db_admin
            where username = v_new_name)
            do
                set v_new_name = concat('root_admin', v_counter);
                set v_counter = v_counter + 1;
            end while;

        update db_admin set username = v_new_name where username = 'root';
    end if;
end;

call temp_rename_root();

drop procedure temp_rename_root;

create procedure temp_modify_username_check()
begin
    declare v_constraint varchar(256);

    select tc.constraint_name
    into v_constraint
    from information_schema.table_constraints     tc
        join information_schema.check_constraints cc
             on cc.constraint_schema = tc.table_schema
                 and cc.constraint_name = tc.constraint_name
    where tc.table_schema = database()
      and tc.table_name = 'db_admin'
      and tc.constraint_type = 'CHECK'
      and cc.check_clause like '%root%'
    limit 1;

    if v_constraint is not null then
        set @drop_sql = concat('ALTER TABLE db_admin DROP CHECK `', v_constraint, '`');
        prepare stmt from @drop_sql;
        execute stmt;
        deallocate prepare stmt;
    end if;

    alter table db_admin
        add constraint check_username
            check (username regexp '^[A-Za-z0-9_.]{8,32}$');
end;

call temp_modify_username_check();

drop procedure temp_modify_username_check;
