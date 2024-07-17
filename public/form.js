document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const form = document.getElementById('dataForm');
    const statusDiv = document.getElementById('status');

    showForm('dataForm', 'Formulário de Dados');

    const saveToLocalStorage = () => {
        const formData = {
            tableId: document.getElementById('tableId').value,
            schemaDb: document.getElementById('schemaDb').value,
            schemaBq: document.getElementById('schemaBq').value,
            isDelete: document.getElementById('isDelete').checked,
            isCreate: document.getElementById('isCreate').checked,
            origin: document.getElementById('origin').value,
            isManualSchema: document.getElementById('isManualSchema').checked,
            isSchedule: document.getElementById('isSchedule').checked,
            scheduleCron: document.getElementById('scheduleCron').value,
        };
        localStorage.setItem('formData', JSON.stringify(formData));
    };

    const loadFromLocalStorage = () => {
        const savedData = localStorage.getItem('formData');
        if (savedData) {
            const formData = JSON.parse(savedData);
            document.getElementById('tableId').value = formData.tableId || '';
            document.getElementById('schemaDb').value = formData.schemaDb || '';
            document.getElementById('schemaBq').value = formData.schemaBq || '';
            document.getElementById('isDelete').checked = formData.isDelete || false;
            document.getElementById('isCreate').checked = formData.isCreate || false;
            document.getElementById('origin').value = formData.origin || 'ssot';
            document.getElementById('isManualSchema').checked = formData.isManualSchema || false;
            document.getElementById('isSchedule').checked = formData.isSchedule || false;
            document.getElementById('scheduleCron').value = formData.scheduleCron || '';

            scheduleSwitch();
        }
    };

    loadFromLocalStorage();

    form.addEventListener('input', saveToLocalStorage);
    form.addEventListener('change', saveToLocalStorage);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tableId = document.getElementById('tableId').value;
        const schemaDb = document.getElementById('schemaDb').value;
        const schemaBq = document.getElementById('schemaBq').value;
        const isDelete = document.getElementById('isDelete').checked;
        const isCreate = document.getElementById('isCreate').checked;
        const origin = document.getElementById('origin').value;
        const isManualSchema = document.getElementById('isManualSchema').checked;
        const isSchedule = document.getElementById('isSchedule').checked;
        const scheduleCron = document.getElementById('scheduleCron').value;


        const response = await fetch('/api/process-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(
                {
                    tableId,
                    schemaDb,
                    schemaBq,
                    isDelete,
                    isCreate,
                    origin,
                    isManualSchema,
                    schema: false,
                    isSchedule,
                    scheduleCron
                }),
        });

        try {

            const data = await response.json();

            if (data.status && isManualSchema) {
                showForm('manual-schema', 'Esquema Manual');
                showSchema(data.schema);

                document.getElementById('form-hidden').value = JSON.stringify(data.form);
            } else {
                showForm('result', 'Sucesso');

                // add the message to the status div
                var resultDiv = document.getElementById('result');
                var div = document.createElement('div');
                div.textContent = data.message;

                // add break line
                var br = document.createElement('br');
                div.appendChild(br);

                // create link element
                var link = document.createElement('a');
                link.href = data.form.link;
                link.textContent = data.form.name;


                // append link to the div
                div.appendChild(link);
                addButtons(resultDiv);
                resultDiv.prepend(div);


            }
        } catch (error) {
            showForm('result', 'Erro');
            var resultDiv = document.getElementById('result');
            var div = document.createElement('div');
            div.textContent = 'Erro ao processar os dados';
            resultDiv.prepend(div);

            addButtons(resultDiv);

        }

    });

    // Add event listener for the schedule switch
    document.getElementById('isSchedule').addEventListener('change', scheduleSwitch);

    // Socket events
    socket.on('status', (message) => {
        // statusDiv.textContent = message;
        var div = document.createElement('div');
        div.textContent = message;
        statusDiv.prepend(div);

        // display the message in the
        statusDiv.style.display = 'block';

    });
});


function showForm(form, value) {
    // hide all forms
    var forms = document.getElementsByClassName('form');
    for (var i = 0; i < forms.length; i++) {
        forms[i].style.display = 'none';
    }

    // show the selected form
    document.getElementById(form).style.display = 'block';

    // troca o título
    document.getElementById('title').textContent = value;

}

function createDivWithClass(className, textContent = '', title = '') {
    const div = document.createElement('div');
    div.className = className;
    div.textContent = textContent;
    if (title) {
        div.title = title;
    }
    return div;
}

function createSelectElement(options, selectedOption) {
    const select = document.createElement('select');
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.textContent = option;
        if (option === selectedOption) {
            optionElement.selected = true;
        }
        select.appendChild(optionElement);
    });
    return select;
}

function showSchema(schema) {
    const formManualSchema = document.getElementById('manual-schema');

    // Create and append div list
    const divList = document.createElement('div');
    divList.className = 'list';
    formManualSchema.appendChild(divList);

    // Header creation
    const headerDiv = createDivWithClass('item header');
    headerDiv.appendChild(createDivWithClass('', 'Name'));
    headerDiv.appendChild(createDivWithClass('', 'Type'));
    headerDiv.appendChild(createDivWithClass('', 'Input'));
    divList.appendChild(headerDiv);

    // Options for select elements
    const options = [
        'STRING', 'ARRAY', 'BIGNUMERIC', 'BOOLEAN', 'BYTES', 'DATE', 'DATETIME',
        'FLOAT64', 'GEOGRAPHY', 'INT64', 'INTERVAL', 'JSON', 'NUMERIC', 'RANGE',
        'STRUCT', 'TIME', 'TIMESTAMP'
    ];

    // Create a div for each item in the schema
    schema.forEach(item => {
        const itemDiv = createDivWithClass('item');
        itemDiv.appendChild(createDivWithClass('', item.name, item.name));
        itemDiv.appendChild(createDivWithClass('', item.type, item.type));

        const select = createSelectElement(options, mapSqlTypeToBigQueryType(item.type));
        const inputDiv = document.createElement('div');
        inputDiv.appendChild(select);
        itemDiv.appendChild(inputDiv);

        divList.appendChild(itemDiv);
    });

    // Create and append submit button
    const button = document.createElement('button');
    button.textContent = 'Salvar';
    formManualSchema.appendChild(button);

    button.addEventListener('click', async (e) => {

        e.preventDefault();
        const items = Array.from(document.getElementsByClassName('item'));
        var schemaSet = items.map((item, i) => {
            const name = item.children[0].textContent;
            const typeOld = item.children[1].textContent;
            const type = item?.children[2]?.children[0]?.value;
            return { name, type, typeOld };
        });

        // remove o primeiro item que é o header
        schemaSet.shift();

        var formHidden = document.getElementById('form-hidden');
        formHidden = JSON.parse(formHidden.value);
        formHidden.isManualSchema = false;

        showForm('progress', 'Formulário de Dados');

        const response = await fetch('/api/process-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                schema: schemaSet,
                ...formHidden
            }),
        });


        const data = await response.json();

        // limpa o formulário
        formManualSchema.innerHTML = '';

        showForm('dataForm', 'Formulário de Dados');
    });
}

function mapSqlTypeToBigQueryType(sqlType) {
    const typeMap = {

        'BIGINT': 'INT64',
        'INT': 'INT64',
        'SMALLINT': 'INT64',
        'TINYINT': 'INT64',

        'BIT': 'BOOLEAN',
        'DECIMAL': 'NUMERIC',
        'NUMERIC': 'NUMERIC',
        'FLOAT': 'FLOAT64',

        'REAL': 'FLOAT64',
        'MONEY': 'FLOAT64',
        'SMALLMONEY': 'FLOAT64',
        'DATE': 'DATE',

        'DATETIME': 'TIMESTAMP',
        'DATETIME2': 'TIMESTAMP',
        'SMALLDATETIME': 'TIMESTAMP',

        'TIME': 'TIME',
        'TIMESTAMP': 'TIMESTAMP',
        'DATETIMEOFFSET': 'TIMESTAMP',

        'CHAR': 'STRING',
        'VARCHAR': 'STRING',
        'TEXT': 'STRING',
        'NCHAR': 'STRING',

        'NVARCHAR': 'STRING',
        'NTEXT': 'STRING'
    };
    return typeMap[sqlType.toUpperCase()] || 'STRING';
}

function scheduleSwitch() {
    var checkBox = document.getElementById("isSchedule");

    if (checkBox.checked == true) {
        document.getElementById("schedule").style.display = "block";
    }
    else {
        document.getElementById("schedule").style.display = "none";
    }
}

function addButtons(element) {
    // add break line
    var br = document.createElement('br');
    element.appendChild(br);
    var button = document.createElement('button');
    button.textContent = 'Voltar';
    button.addEventListener('click', function () {
        location.reload();
    });

    element.appendChild(button);
}
