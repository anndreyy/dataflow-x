const { ensureDatasetExists, loadToBigQuery } = require('../services/bigQueryService');
const { cloudSchedulerJobs } = require('../services/cloudScheduler');


async function loadDataToBigQuery(req, res) {
    const { datasetId, tableId, data, schema, isDelete, isCreate, attemptsMax } = req.body;

    try {
        await ensureDatasetExists(datasetId);
        
        // Split the data into smaller chunks
        const chunkSize = 5000; // Set the desired chunk size
        const chunks = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, i + chunkSize));
        }
        
        // Load each chunk to BigQuery
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            await loadToBigQuery(datasetId, tableId, chunk, schema, isDelete, isCreate, attemptsMax);
            console.log(`Chunk ${i + 1} loaded to BigQuery`);
        }
        
        res.json({ message: 'Dados carregados com sucesso no BigQuery' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = { loadDataToBigQuery };
