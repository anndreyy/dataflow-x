require('dotenv').config();

const sqlConfig = {
    ssot: {
        user: process.env.SSOT_USERNAME,
        password: process.env.SSOT_PASSWORD,
        server: process.env.SSOT_SERVER,
        database: process.env.SSOT_DATABASE,
        options: {
            encrypt: true,
            enableArithAbort: true,
            trustServerCertificate: true,
        }
    },
    rentsoft: {
        user: process.env.RENTSOFT_USERNAME,
        password: process.env.RENTSOFT_PASSWORD,
        server: process.env.RENTSOFT_SERVER,
        database: process.env.RENTSOFT_DATABASE,
        options: {
            encrypt: true,
            enableArithAbort: true,
            trustServerCertificate: true,
        }
    },
    salesforce: {
        user: process.env.SALESFORCE_USERNAME,
        password: process.env.SALESFORCE_PASSWORD,
        server: process.env.SALESFORCE_SERVER,
        database: process.env.SALESFORCE_DATABASE,
        options: {
            encrypt: true,
            enableArithAbort: true,
            trustServerCertificate: true,
        }
    },
    protheus: {
        user: process.env.PROTHEUS_USERNAME,
        password: process.env.PROTHEUS_PASSWORD,
        server: process.env.PROTHEUS_SERVER,
        database: process.env.PROTHEUS_DATABASE,
        options: {
            encrypt: true,
            enableArithAbort: true,
            trustServerCertificate: true,
        }
    }
};

const bigQueryConfig = {
    projectId: process.env.BIGQUERY_PROJECT_ID,
    keyFilename: process.env.BIGQUERY_KEY_FILE,
};

module.exports = { sqlConfig, bigQueryConfig };
