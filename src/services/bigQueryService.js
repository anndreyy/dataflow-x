const { BigQuery } = require('@google-cloud/bigquery');
const { bigQueryConfig } = require('../config/config');
const fs = require('fs');
const path = require('path');
// const { ParquetWriter } = require('parquets');
const parquet = require('parquets'); // Adicione isto se ainda não estiver presente
const rootPath = path.resolve(__dirname, '../..');


const bigquery = new BigQuery(bigQueryConfig);

async function ensureDatasetExists(datasetId) {
    const dataset = bigquery.dataset(datasetId);
    const [exists] = await dataset.exists();
    if (!exists) {
        await dataset.create();
        console.log(`Dataset ${datasetId} criado com sucesso.`);
    }
}

async function ensureTableExists(dataset, tableId) {
    const table = dataset.table(tableId);
    const [exists] = await table.exists();
    return exists;
}

function convertDataTypes(data) {
    return data.map(row => {
        const newRow = { ...row };
        for (const key in newRow) {
            if (typeof newRow[key] === 'boolean') {
                newRow[key] = newRow[key].toString();
            }
        }
        return newRow;
    });
}

async function loadToBigQuery(datasetId, tableId, data, schema, isDelete, isCreate, attemptsMax, io = console) {
    const dataset = bigquery.dataset(datasetId);
    const tablebq = dataset.table(tableId);

    if (isDelete) {
        try {
            io.log(`Excluindo tabela ${tableId}...`);
            await tablebq.delete({ ignoreNotFound: true });
            io.log(`Tabela ${tableId} excluída com sucesso.`);
        } catch (err) {
            io.log('Erro ao excluir a tabela no BigQuery:', err);
        }
    }

    if (isCreate) {
        try {
            await dataset.createTable(tableId, { schema });
            io.log(`Tabela ${tableId} criada com sucesso.`);

            let tableExists = await ensureTableExists(dataset, tableId);
            let attempts = 0;

            while (!tableExists && attempts < attemptsMax) {
                io.log('Esperando pela criação da tabela...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                tableExists = await ensureTableExists(dataset, tableId);
                attempts++;
            }

            if (!tableExists) {
                throw new Error(`Tabela ${tableId} não foi encontrada após a criação.`);
            }
        } catch (err) {
            io.log('Erro ao criar a tabela no BigQuery:', err);
            return;
        }
    }

    const convertedData = convertDataTypes(data);

    try {
        await insertBiqueryParquet(tableId, datasetId, convertedData, schema, io);
    } catch (err) {
        io.log('Erro ao inserir dados no BigQuery:', err);
        throw err;
    }
}

// Insert data into BigQuery in batches and log the process
async function insertData(table, data, batchSize, io = console) {
    const totalRows = data.length;
    const totalBatches = Math.ceil(totalRows / batchSize);

    for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = start + batchSize;
        const batchData = data.slice(start, end);

        try {
            await table.insert(batchData);
            io.log(`Batch ${i + 1}/${totalBatches} inserted successfully.`);
        } catch (err) {
            io.log(`Error inserting batch ${i + 1}/${totalBatches}:`, err.message);
            throw err;
        }
    }

    io.log('All data inserted successfully.');
}

async function insertBiqueryParquet(tableId, datasetId, arrData, schema, io = console) {
    const size = 5000; // Tamanho do grupo de registros a serem enviados para o bq
    // const folderParquet = rootPath`/temp/${tableId}-bq-parquet`;
    const folderParquet = path.resolve(rootPath, 'temp', `${tableId}-bq-parquet`);
    const arrJobs = []; // Array de jobs

    // separa em grupos de 1000 registros
    const groups = [];
    for (let i = 0; i < arrData.length; i += size) {
        groups.push(arrData.slice(i, i + size));
    }

    // Insere os dados no BigQuery
    for (let i = 0; i < groups.length; i++) {
        await toParquet(groups[i], schema, folderParquet, `${tableId}_${i}.parquet`);
    }

    // Carrega os arquivos parquet no BigQuery
    for (let i = 0; i < groups.length; i++) {
        const fileName = `${tableId}_${i}.parquet`;
        const progress = ((i + 1) / groups.length) * 100;
        io.log(`Status load: ${tableId} (${i + 1}/${groups.length}) - ${progress.toFixed(2)}% concluído`);
        let resJob = await insertDataIntoBigQueryParquet(datasetId, tableId, folderParquet, fileName);
        arrJobs.push(resJob);
    }

    // io.log(`[LoadBigQuery] Arquivos carregados no BigQuery`);

    // apaga os arquivos
    await cleanTemp(folderParquet);

    return arrJobs;
}

/**
    * Salva os dados em um arquivo Parquet
    * @param {*} arrData 
    * @param {*} schema 
    * @param {*} folderParquet 
    * @param {*} filePath 
    */
async function toParquet(arrData, schema, folderParquet, filePath) {
    try {
        const dir = folderParquet;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {
                recursive: true
            });
        }

        filePath = path.resolve(dir, filePath);

        // Converte o esquema para o formato Parquet
        const parquetSchema = schemaBqToParquet(schema);

        // Cria um escritor Parquet com o esquema definido
        const writer = await parquet.ParquetWriter.openFile(parquetSchema, filePath);

        // Adiciona os dados ao arquivo Parquet
        for (let i = 0; i < arrData.length; i++) {
            await writer.appendRow(arrData[i]);
        }

        // Fecha o escritor e finaliza o arquivo Parquet
        await writer.close();
    } catch (error) {
        console.error('Erro ao salvar dados em arquivo Parquet:', error);
        throw error;
    }
}


/**
 * Converte o schema do BigQuery para o schema do Parquet
 * @param {*} schema 
 */
function schemaBqToParquet(schema) {
    const typeMapping = {
        "STRING": "UTF8",
        "INTEGER": "INT64",
        "FLOAT": "DOUBLE",
        "BOOLEAN": "BOOLEAN",
        "TIMESTAMP": "TIMESTAMP_MILLIS",
        "FLOAT64": "DOUBLE",
        "INT64": "INT64",
        // Adicione outros mapeamentos conforme necessário
    };

    const schemaParquet = {};
    for (let i = 0; i < schema.length; i++) {
        const column = schema[i];
        schemaParquet[column.name] = { type: typeMapping[column.type], optional: true };

        if (!typeMapping[column.type]) {
            console.log(`Tipo de dado ${column.type} não mapeado para o Parquet`);
            throw new Error(`Tipo de dado ${column.type} não mapeado para o Parquet`);

        }
    }


    return new parquet.ParquetSchema(schemaParquet);
}

/**
     * Função para apagar pasta temporária
     * 
     * @param {*} folderPath 
     * @returns 
     */
async function cleanTemp(folderPath) {
    const dir = path.resolve(rootPath, folderPath);

    try {
        // Verifica se o caminha existe e se não, cria
        if (!fs.existsSync(dir)) {
            throw new Error('Pasta não encontrada');
        }

        // Apaga a pasta
        fs.rmSync(dir, { recursive: true });

        return true;

    } catch (error) {
        console.log('Erro ao apagar pasta:', error);
    }

}

/**
     * Função para carregar arquivo Parquet no BigQuery
     * @param {*} datasetId 
     * @param {*} tableId 
     * @param {*} folderParquet 
     * @param {*} filePath 
     * @returns 
     */
async function insertDataIntoBigQueryParquet(datasetId, tableId, folderParquet, filePath) {
    const bigquery = new BigQuery();

    // Configuração da tarefa de carregamento
    const metadata = {
        sourceFormat: 'PARQUET',
        location: 'southamerica-east1' 
    };

    // Caminho completo para o arquivo Parquet
    const parquetFile = path.resolve(folderParquet, filePath);

    try {
        // Carrega arquivo no BigQuery
        const [job] = await bigquery
            .dataset(datasetId)
            .table(tableId)
            .load(parquetFile, metadata);

        // Espera a tarefa de carregamento terminar
        // console.log(`Job ${job.id} iniciado.`);

        // console.log(`Arquivo Parquet ${filePath} carregado com sucesso no BigQuery.`);
        return job;
    } catch (error) {
        console.error('Erro ao carregar arquivo Parquet no BigQuery:', error);
    }
}


module.exports = {
    ensureDatasetExists,
    loadToBigQuery
};
