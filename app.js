var express = require('express');
var path = require('path');

var fs = require('fs');

const config = require('./config');
var Excel = require('exceljs');

var bodyParser = require('body-parser')

var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({limit: '50mb'}));
app.use(
  '/javascripts',
  express.static(path.join(__dirname, 'node_modules', 'jquery', 'dist'))
);

const routes = require('./routes');
global.appRoot = path.resolve(__dirname);

app.get('/', function (req, res) {
  res.render('index');
});

app.use('/api/events', routes.events);

const {Builder, By, Key, until} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

let arrContent = {};

var SetExcel = (data) => {
  var workbook = new Excel.Workbook();
  var sheet = workbook.addWorksheet('My Sheet');

  sheet.columns = [
    { header: 'Наименование', key: 'Name', width: 60 },
    { header: 'Медиана', key: 'Med', width: 20 },
    { header: 'Среднее', key: 'Avg', width: 20 },
  ];


  Object.keys(data).map(item => {
    sheet.addRow([item, data[item].Mediana, data[item].Avg]);
  });

  workbook.xlsx.writeFile('parsing.xlsx')
  .catch(err => {
    console.log(err);
  })
}

var status_parsing = true;

io.on('connection', socket => {
  console.log('Пользователь подключился');

  socket.on('disconnect', () => {
    console.log('Пользователь отключился');
  });

  socket.on('parsing', async (msg) => {
    let command = msg.command;
    if (command == 'begin') {

      const path_s = msg.path;

      var filename = path.join(appRoot, path_s);
      let workbook = new Excel.Workbook();
      let data = await workbook.xlsx.readFile(filename);

      let worksheet = workbook.getWorksheet(data.worksheets[0].name); 

      let options = new chrome.Options();
      options.addArguments("--headless");
      options.addArguments("--disable-gpu");
      options.addArguments("--no-sandbox");

      let arr = [];

      worksheet.eachRow({ includeEmpty: false }, async function(row, rowNumber) {
          if (row.values[1] && rowNumber > 1) {
            arr.push(row.values[1]);
          }
      });

      let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
      io.emit('parsing status', 'Начинаем парсить данные...');

      try {
        await driver.get('https://market.yandex.ru/');

        let col = 1;
        for (const item of arr) {
          let start = new Date();
          try {
            try {
              let inputForm = await driver.findElement(By.xpath('/html/body/div[1]/div[1]/noindex/div/div/div[2]/div/div[1]/form/span/span[1]/span/span/input[1]'));
              await inputForm.clear();
              await inputForm.sendKeys(item+'\n');
            } catch (e) {
              let inputForm = await driver.findElement(By.xpath('/html/body/div[1]/div/div[1]/noindex/div/div/div[2]/div/div[1]/form/span/span[1]/span/span/input[1]'));
              await inputForm.clear();
              await inputForm.sendKeys(item+'\n');
            }

            try {
              const source = await driver.getPageSource();
              io.emit('transfer code', {status: true, source, item});
            } catch(e) {
              console.log(e);
              io.emit('transfer code', {status: false, item});
            }
            

          } catch(e1) {
            console.log(e1);
            io.emit('transfer code', {status: false, item});
          }

          
          let finish = new Date();
          let minute = Number((finish-start)/60000*(arr.length-col)).toFixed(2);
          let second = Number((finish-start)/1000*(arr.length-col)).toFixed(2)
          io.emit('parsing status', `Обработано ${col} из ${arr.length}. Осталось, примерно: ${second} сек. или ${minute} мин.`);
          col ++;

          if (!status_parsing) {
            break;
          }
        }
        
        driver.quit();

        io.emit('parsing status', 'Парсинг завершен');
      } catch (e) {
        console.log(e);
      }

      await SetExcel(arrContent);

    }
  });

  socket.on('parsing stop', () => {
    status_parsing = false;
  });

  socket.on('update excel', data => {
    let name = data.name;
    let avg = data.avg;
    let mediana = data.mediana;

    arrContent[name] = {
      Mediana: mediana,
      Avg: avg
    }
  })
});

http.listen(config.PORT, () =>
  console.log(`Example app listening on port ${config.PORT}!`)
);