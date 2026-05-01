alter table db_admin
    drop check check_username,
    add check (username = 'root' or username regexp '^[A-Za-z0-9_.]{8,32}$');

update db_admin
set
    username = 'root'
where role = 'super'
  and username regexp '^root_admin[0-9]*$';

alter table db_admin
    drop column role;

alter table db_admin
    modify column id int unsigned not null;

alter table db_admin
    drop primary key,
    drop index username,
    add primary key (username);

alter table db_admin
    drop column id;
