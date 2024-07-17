const { fetchTableSchema } = require('../models/sqlModel');
const { mapSqlTypeToBigQueryType } = require('../utils/typeMapping');

async function inferSchemaFromDb(origin, schemadb, table) {
    const schema = [];
    const schemaBase = [];
    const tableSchema = await fetchTableSchema(origin, schemadb, table);

    tableSchema.forEach(column => {
        const bigQueryType = mapSqlTypeToBigQueryType(column.DATA_TYPE);
        schema.push({ name: column.COLUMN_NAME, type: bigQueryType });
        schemaBase.push({ name: column.COLUMN_NAME, type: column.DATA_TYPE });
    });

    return {
        base: schemaBase,
        inferred: schema
    };
}

module.exports = { inferSchemaFromDb };
