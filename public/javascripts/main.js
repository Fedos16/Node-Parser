$(document).ready(() => {

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


    socket.on('parsing status', msg => {

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
    });

    $(document).delegate('#parsing_stop', 'click', (e) => {
        socket.emit('parsing stop');
        $(e.target).attr('disabled', 'disabled');
    });

});