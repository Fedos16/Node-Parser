$(document).ready(() => {

    var calcMedian = (arr) => {
        var half = Math.floor(arr.length / 2);
        arr.sort(function(a, b) { return a - b;});
      
        if (arr.length % 2) {
          return arr[half];
        } else {
          return (arr[half] + arr[half] + 1) / 2;
        }
    }
    var calcGrades = (arr) => {
        let total = 0;
        for(let i = 0; i < arr.length; i++) {
            total += arr[i];
        }
        let avg = total / arr.length;
        return avg;
    }

    var socket = io();

    $(document).delegate("#upload_file_node", "change", (e) => {

        var formData = new FormData();
        formData.append('file', $('#upload_file_node')[0].files[0]);

        $.ajax({
            type: 'POST',
            url: '/api/events/saveexcel',
            data: formData,
            processData: false,
            contentType: false
        }).done(function(data){
            if (data.ok){

                $('.status p').text('Начинаем парсить данные ...');
                $(e.target).attr('disabled', 'disabled');
                $('#upload_foto').text('Загрузка данных ...');
                $('#upload_foto').addClass('cl_disabled');
                $('#parsing_stop').removeAttr('disabled');
                $('#upload_file_node').val("");
                $('#DataTable tbody').html('');
                socket.emit('parsing', {command: 'begin', path: data.path});
            } else {
                console.log(data);
            }
        });
    });
    $(document).delegate('#download_file', 'click', (e) => {
        window.open('/api/events/downloadExcel');
        $(e.target).attr('disabled', 'disabled');
    });
    $(document).delegate('#parsing_stop', 'click', (e) => {
        socket.emit('parsing stop');
        $(e.target).attr('disabled', 'disabled');
    });


    socket
    .on('parsing status', msg => {

        $('.status p').text(msg);
        
        if (msg == 'Парсинг завершен') {
            $('#upload_file_node').removeAttr('disabled');
            $('#upload_foto').removeClass('cl_disabled');
            $('#upload_foto').html(`
                <input type="file" id="upload_file_node" id="file" name="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
                Начать парсинг`);
            $('#parsing_stop').attr('disabled', 'disabled');
            $('#download_file').removeAttr('disabled');
        }
    })
    .on('transfer code', data => {

        let colRow = $('#DataTable tbody tr').length+1;
        let name = data.item;

        if (data.status) {
            let source = data.source;
            let parser = new DOMParser();
            let text = parser.parseFromString(source, 'text/html');

            let items = $(text).find('.n-snippet-card2');
            if (items.length == 0) items = $(text).find('.n-snippet-cell2');

            let arrPrice = [];

            for (let i=0; i < items.length; i++) {
                if (i > 9) break;

                let elem = $(items[i]).find('.price');
                let price = $(elem[0]).text();
                if (elem.length > 2) price = $(elem[1]).text();

                price = Number(price.replace(/\s*₽*/g, ''));
                
                arrPrice.push(price);
            }
            let avg = Math.round(calcGrades(arrPrice));
            let mediana = Math.round(calcMedian(arrPrice));

            socket.emit('update excel', {name, avg, mediana});

            $('#DataTable tbody').append(`
                <tr>
                    <td>${colRow}</td>
                    <td>${name}</td>
                    <td>${avg}</td>
                    <td>${mediana}</td>
                </tr>
            `);
        } else {
            $('#DataTable tbody').append(`
                <tr>
                    <td>${colRow}</td>
                    <td>${name}</td>
                    <td>Ошибка</td>
                    <td>Ошибка</td>
                </tr>
            `)
        }
    });

});