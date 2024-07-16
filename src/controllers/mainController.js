const { connectToSql, fetchData } = require('../models/sqlModel');
const { inferSchemaFromDb } = require('../services/schemaService');
const { ensureDatasetExists, loadToBigQuery } = require('../services/bigQueryService');
const { cloudSchedulerJobCreate, cloudSchedulerJobDelete } = require('../services/cloudScheduler');
const package = require('../../package.json');

async function processData(req, res) {
    var form = req.body;

    const io = req.app.get('socketio');
    io.log = function (...args) { io.emit('status', args.join(' ')); console.log(...args) }

    try {
        await connectToSql(form.origin, io);

        const data = await fetchData(form.schemaDb, form.tableId, io);

        if (!form.schema) {
            var dataSchema = await inferSchemaFromDb(form.schemaDb, form.tableId);
            form.schema = dataSchema.inferred;
            io.log(`Esquema inferido do SQL Server, ${form.schema.length} colunas`);
        }

        if (form.isManualSchema) {
            io.log('Usando esquema manual');

            // redireciona para a rota de schema manual
            return res.send({
                message: 'Usando esquema manual',
                form,
                schema: dataSchema.base,
                status: true
            });
        }

        await ensureDatasetExists(form.schemaBq);
        io.log('Dataset BigQuery garantido');

        await loadToBigQuery(form.schemaBq, `${form.origin}_${form.tableId}`, data, form.schema, form.isDelete, form.isCreate, 20, io);
        io.log('Dados carregados no BigQuery');


        if (form.isSchedule) {
            io.log('Criando job no Cloud Scheduler');
            const jobData = {
                jobName: `${package.name}_${form.origin}_${form.tableId}`,
                timeZone: 'America/Sao_Paulo',
                schedule: form.scheduleCron,
                uri: `${process.env.BASE_URL}/api/process-data`,
                httpMethod: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: {
                    tableId: form.tableId,
                    schemaDb: form.schemaDb,
                    schemaBq: form.schemaBq,
                    isDelete: form.isDelete,
                    isCreate: form.isCreate,
                    origin: form.origin,
                    schema: form.schema
                }
            };

            // replace _ por -
            jobData.jobName = jobData.jobName.replace(/_/g, '-');

            const resCloudSchedulerJobDelete = await cloudSchedulerJobDelete(jobData.jobName, io);
            io.log('Job deletado do Cloud Scheduler');
            const resCloudSchedulerJobCreate = await cloudSchedulerJobCreate(jobData, io);
            io.log('Job criado no Cloud Scheduler');
        }

        io.log(`link: https://console.cloud.google.com/bigquery?ws=!1m5!1m4!4m3!1sssot-391717!2sraw!3s${form.origin}_${form.tableId}&project=ssot-391717`);

        res.json({ message: 'Dados processados e carregados no BigQuery com sucesso.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}

module.exports = { processData };
