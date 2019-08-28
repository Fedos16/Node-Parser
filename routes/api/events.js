const express = require('express');
const router = express.Router();
const config = require('../../config');

const multer = require('multer');
const mkdirp = require('mkdirp');

const diskStorage = require('../../utils/diskStorage');

var path = require('path');
const fs = require('fs');

var storage = multer.diskStorage({
    destination: (req, file, cb) => {

        mkdirp(config.DESTINATION, err => cb(err, config.DESTINATION));
        // cd(null, config.DESTINATION + dir);
    },
    filename: function (req, file, cb) {
        let ext = ''; // set default extension (if any)
        if (file.originalname.split(".").length>1) // checking if there is an extension or not.
            ext = file.originalname.substring(file.originalname.lastIndexOf('.'), file.originalname.length);
        cb(null, 'source_file' + ext)
    }
})
var upload = multer({ storage: storage });

// SAVE IMAGE
router.post('/saveexcel', upload.single("file"), async (req, res) => {

    var filename = path.join(__dirname, req.file.path)
    res.json({ok: true, path: req.file.path});

});
router.get('/downloadExcel', (req, res) => {

    let FilePath = path.join(path.dirname(require.main.filename), 'parsing.xlsx');

    res.download(FilePath, 'parsing.xlsx', (err) => {
        if (err) console.log(err);
        fs.unlink(FilePath, function(err){
            if(err) return console.log(err);
            console.log('File deleted successfully');
       });
    })
});

module.exports = router;