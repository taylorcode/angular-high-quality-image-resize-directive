var express = require('express');
var http    = require('http');
var path    = require('path');
var fs      = require('fs');

function trueRandom () {
    return Math.random().toString(36).substring(7) + '-' + (+new Date()).toString(36);
}

var app = express();

app.configure(function() {
    app.set('port', process.env.PORT || 5000);
    app.use(express.bodyParser());
    app.use(express.static(path.join(__dirname, 'public')));    
});


app.get('/', function(req, res){
    res.sendfile(__dirname + '/demo.html');
});


function readWriteImage(newImageLocation) {

    return function (imagePath, callback) {
    
        fs.readFile(imagePath, function(err, data) {


            fs.writeFile(newImageLocation, data, callback);

        });
    }
}

app.post('/upload', function(req, res, next) {

    // can be single image or multiple images
    var images = req.files.image ? [req.files.image] : req.files.images;


    (function writeImageCaller (images, index) {

        var image = images[index];

        readWriteImage(path.join(__dirname, 'public/images', trueRandom() + '.jpg'))(image.path, function (err) {

            if(err) return next(err); // error writing file

            index++;
            if(images[index]) return writeImageCaller(images, index); // recursive call

            res.json(200, { 
                message: 'images uploaded.'
            });

        });

    })(images, 0);

});

http.createServer(app).listen(app.get('port'), function() {
    console.log("imageupload demo running on port " + app.get('port'));
});