require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const bodyParser = require('body-parser');
const routes = require('./routes/index');
const initializeSocket = require('./socket');
const package = require('../package.json');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', routes);

const server = http.createServer(app);
const io = initializeSocket(server);

app.set('socketio', io);

app.get('/', (req, res) => {
    res.render('form');
});
app.get('/jobs', (req, res) => {
    res.render('jobs');
});

app.all('/test', (req, res) => {
    res.status(200).send({
        name: package.name,
        version: package.version,
        description: package.description,
        timestamp: new Date().toISOString(),
    });
});

app.all('*', (req, res) => {
    res.status(404).send('Página não encontrada');
});


server.listen(port, () => {
    console.log(`Servidor rodando na porta http://localhost:${port}`);
});
