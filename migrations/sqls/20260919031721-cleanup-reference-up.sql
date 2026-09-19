drop trigger reference_insert_check_trigger;

drop table reference_author;

alter table reference
    drop foreign key reference_ibfk_1,
    drop foreign key reference_ibfk_2;

alter table reference
    drop column year,
    drop column other,
    drop column title,
    drop column type,
    drop column ref_article_id,
    drop column ref_city_id;

drop table ref_article;

drop table journal_volume;

drop table journal;

drop table ref_city;

drop table ref_author;

