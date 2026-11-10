export const SQLITE_INDEX_METADATA_SQL = `
  select indexes.name, tables.name as table_name, columns.name as column_name,
         indexes."unique" as is_unique, indexes.origin = 'pk' as is_primary,
         indexes.partial as is_partial, columns.desc as descending,
         null as prefix_length,
         case when indexes.partial = 1 then substr(definition.sql, instr(upper(definition.sql), ' WHERE ') + 7) else null end as predicate
  from sqlite_master as tables
  join pragma_index_list(tables.name) as indexes
  join pragma_index_xinfo(indexes.name) as columns
  left join sqlite_master as definition on definition.name = indexes.name and definition.type = 'index'
  where tables.type = 'table' and columns.key = 1
  order by tables.name, indexes.name, columns.seqno`;
