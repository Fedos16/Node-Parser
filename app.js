var express = require('express');
var path = require('path');

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

var calcMedian = (ar1) => {
  var half = Math.floor(ar1.length / 2);
  ar1.sort(function(a, b) { return a - b;});

  if (ar1.length % 2) {
    return ar1[half];
  } else {
    return (ar1[half] + ar1[half] + 1) / 2.0;
  }
}
var calcGrades = (grades) => {
  let total = 0;
  for(let i = 0; i < grades.length; i++) {
      total += grades[i];
  }
  let avg = total / grades.length;
  return avg;
}
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
      io.emit('parsing status', 'Начинаем парсить данные');
      let arrInput = ['//*[@id="header-search"]', '/html/body/div[1]/div/div[1]/noindex/div/div/div[2]/div/div[1]/form/span/span[1]/span/span/input[1]'];

      try {
        await driver.get('https://market.yandex.ru/');
        
        let arrContent = {};

        let col = 1;
        for (const item of arr) {
          let start = new Date();
          let dataRow = {};
          try {
            let inputForm = await driver.findElement(By.xpath('//*[@id="header-search"]'));
            await inputForm.clear();
            await inputForm.sendKeys(item+'\n');
            await driver.findElement(By.xpath('/html/body/div[1]/div[5]/div[1]/div[2]/div[2]/div/span/label[1]/input')).click();

            driver.sleep(1000);

            let arrPrice = [];
            for (let i=1; i < 11; i++) {
              try {
                let pre_price = await driver.findElement(By.xpath(`/html/body/div[1]/div[5]/div[2]/div[1]/div[2]/div/div[1]/div[${i}]/div[6]/div[1]/div[1]/div/div/a/div`)).getText();
                let price = String(pre_price).replace(' ₽', '');
                arrPrice.push(Number(price));
              } catch (e) {
                let pre_price = await driver.findElement(By.xpath(`/html/body/div[1]/div[5]/div[2]/div[1]/div[2]/div/div[1]/div[${i}]/div[5]/div[1]/div[1]/div/div/a/div`)).getText();
                let price = String(pre_price).replace(' ₽', '');
                arrPrice.push(Number(price));
              }
            }

            let mdeiana = Number(calcMedian(arrPrice)).toFixed(0);
            let avg = Number(calcGrades(arrPrice)).toFixed(0);

            arrContent[item] = {
              Mediana: mdeiana,
              Avg: avg,
            }

            dataRow = {Name: item, Mediana: mdeiana, Avg: avg};

          } catch(e1) {
            console.log(e1);
            console.log(item);
            dataRow = {Name: item, Mediana: 'Ошибка', Avg: 'Ошибка'};
          }

          
          let finish = new Date();
          let minute = Number((finish-start)/60000*(arr.length-col)).toFixed(2);
          let second = Number((finish-start)/1000*(arr.length-col)).toFixed(2)
          io.emit('parsing status', `Обработано ${col} из ${arr.length}. Осталось, примерно: ${second} сек. или ${minute} мин.`);
          io.emit('parsing data', dataRow);
          col ++;

          if (!status_parsing) {
            break;
          }
        }

        await SetExcel(arrContent);
        
        driver.quit();
        io.emit('parsing status', 'Парсинг завершен');
      } catch (e) {
        console.log(e);
      }

    }
  });
  socket.on('parsing stop', (msg) => {
    status_parsing = false;
  })
});

http.listen(config.PORT, () =>
  console.log(`Example app listening on port ${config.PORT}!`)
);