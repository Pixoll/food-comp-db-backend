alter table reference
    add column text text null;

set session group_concat_max_len = 65535;

update reference as r

    left join ref_city as rc
    on r.ref_city_id = rc.id

    left join ref_article as ra
    on r.ref_article_id = ra.id

    left join journal_volume as jv
    on ra.volume_id = jv.id

    left join journal as j
    on jv.journal_id = j.id

    left join (
        select
            rea.reference_code,
            group_concat(
                    nullif(trim(a.name), '')
                    order by a.id
                    separator '; '
            ) as authors
        from reference_author as rea
                 join ref_author as a
                      on rea.author_id = a.id
        group by rea.reference_code
    ) as authors
    on r.code = authors.reference_code

set r.text = concat(
        concat_ws(
                '. ',
                nullif(trim(trailing '.' from trim(authors.authors)), ''),
                nullif(trim(trailing '.' from trim(r.title)), ''),
                case
                    when r.type = 'article'
                        then nullif(trim(j.name), '')
                    end,

                case
                    when r.type = 'article'
                        and jv.volume is not null
                        then concat(
                            'Vol. ',
                            jv.volume,
                            if(
                                    jv.issue is not null,
                                    concat('(', jv.issue, ')'),
                                    ''
                            )
                             )
                    end,

                case
                    when r.type = 'article'
                        and ra.page_start is not null
                        and ra.page_end is not null
                        then concat(
                            'pp. ',
                            ra.page_start,
                            '-',
                            ra.page_end
                             )
                    end,
                case
                    when r.type in ('thesis', 'report', 'book')
                        then nullif(trim(rc.name), '')
                    end,

                cast(r.year as char),

                nullif(trim(trailing '.' from trim(r.other)), '')
        ),
        '.'
             );

alter table reference
    modify column text text not null;
