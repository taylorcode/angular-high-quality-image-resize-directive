angular.module('imageupload', [])

.directive('image', function (gamealchemist) {

    'use strict'

    var URL = window.URL || window.webkitURL;

    function createImage (url, callback) {
        var image = new Image();
        image.onload = function() {
            callback(image);
        };
        image.src = url;
    };

    function resizeImageFile (file, resizedName, options, callback) {

        var url = URL.createObjectURL(file);

        createImage(url, function (img) {

            var maxHeight = options.resizeMaxHeight || 300,
                maxWidth = options.resizeMaxWidth || 250,
                height = img.height,
                width = img.width,
                scaleFactor = 1;

            // calculate the width and height, constraining the proportions
            if (width > height) {
                if (width > maxWidth) {
                    scaleFactor = maxWidth / img.width;
                }
            } else {
                if (height > maxHeight) {
                    scaleFactor = maxHeight / img.height;
                }
            }

            if(scaleFactor >= 1) return callback(file); // don't resize, just invoke callback with original image src (which should be the blob)
            
            gamealchemist.downScaleImage(img, scaleFactor).toBlob(callback);
       
        });

    };

    function setApplyScope (scope, attrs) {

        return function (file) {

            var imageResult = {
                file: file, 
                url: URL.createObjectURL(file)
            };

            scope.$apply(function() {

                if(attrs.multiple) return scope.image.push(imageResult);

                scope.image = imageResult; 

            });
        }

    };


    return {

        restrict: 'A',

        scope: {
            image: '=',
            resizeMaxHeight: '@?',
            resizeMaxWidth: '@?',
            resizeQuality: '@?',
            resizeType: '@?',
        },

        link: function postLink (scope, element, attrs, ctrl) {

            //when multiple always return an array of images
            if(attrs.multiple) scope.image = [];

            var applyScope = setApplyScope(scope, attrs);

            element.bind('change', function (evt) {

                var files = evt.target.files;

                for(var i = 0, file; file = files[i]; i++) {

                    if(scope.resizeMaxHeight || scope.resizeMaxWidth) { //resize image

                        resizeImageFile(file, file.name, scope, applyScope);

                    } else { //no resizing
                        applyScope(file);
                    }
                    
                }
            });
        }
    };
})

.factory('gamealchemist', (function () {

    'use strict'

    /**
     * @author Taylor McIntyre
     * @url taylorcode.com
     * @date Feb 15, 2014
     * @description
     * Functions for downscaling an image using canvas.
     * @credits
     * http://stackoverflow.com/questions/18922880/html5-canvas-resize-downscale-image-high-quality
     * http://jsfiddle.net/gamealchemist/kpQyE/3/
     * 
     * @dependencies 
     * toBlob polyfill from https://github.com/eligrey/canvas-toBlob.js/
     *
     */

    /**
     * @taylorcode function
     * @name downScaleImage
     * @function
     *
     * @description
     * Creates an image canvas, uses `downScaleCanvas` to downscale the image canvas, uses native `toBlob` or polyfill to convert the canvas data into a blob.
     *
     * @param {Object} img The original Image that will be resized.
     * @param {Object} scale The resize scale factor.
     * @param {Function} callback the callback that will be invoked after the resize is complete with the resized imaged as its only argument.
     * @returns {Object} nothing useful because it relies on a callback. TODO return a promise.
     */

    function downScaleImage (img, scale, callback) {
        var imgCV = document.createElement('canvas');
        imgCV.width = img.width;
        imgCV.height = img.height;
        var imgCtx = imgCV.getContext('2d');
        imgCtx.drawImage(img, 0, 0);
        return downScaleCanvas(imgCV, scale);
    }

    /**
     * @taylorcode function
     * @name downScaleCanvas
     * @function
     *
     * @description
     * Resizes a canvas.
     *
     * @param {Object} cv The canvas to be resized.
     * @param {Object} scale The resize scale factor.
     * @returns {Object} The resized canvas.
     */

    function downScaleCanvas (cv, scale) {
        if (!(scale < 1) || !(scale > 0)) throw ('scale must be a positive number <1 ');
        var sqScale = scale * scale; // square scale = area of source pixel within target
        var sw = cv.width; // source image width
        var sh = cv.height; // source image height
        var tw = Math.ceil(sw * scale); // target image width
        var th = Math.ceil(sh * scale); // target image height
        var sx = 0, sy = 0, sIndex = 0; // source x,y, index within source array
        var tx = 0, ty = 0, yIndex = 0, tIndex = 0; // target x,y, x,y index within target array
        var tX = 0, tY = 0; // rounded tx, ty
        var w = 0, nw = 0, wx = 0, nwx = 0, wy = 0, nwy = 0; // weight / next weight x / y
        // weight is weight of current source point within target.
        // next weight is weight of current source point within next target's point.
        var crossX = false; // does scaled px cross its current px right border ?
        var crossY = false; // does scaled px cross its current px bottom border ?
        var sBuffer = cv.getContext('2d').
        getImageData(0, 0, sw, sh).data; // source buffer 8 bit rgba
        var tBuffer = new Float32Array(4 * sw * sh); // target buffer Float32 rgb
        var sR = 0, sG = 0,  sB = 0; // source's current point r,g,b
        // untested !
        var sA = 0;  //source alpha    

        for (sy = 0; sy < sh; sy++) {
            ty = sy * scale; // y src position within target
            tY = 0 | ty;     // rounded : target pixel's y
            yIndex = 4 * tY * tw;  // line index within target array
            crossY = (tY != (0 | ty + scale)); 
            if (crossY) { // if pixel is crossing botton target pixel
                wy = (tY + 1 - ty); // weight of point within target pixel
                nwy = (ty + scale - tY - 1); // ... within y+1 target pixel
            }
            for (sx = 0; sx < sw; sx++, sIndex += 4) {
                tx = sx * scale; // x src position within target
                tX = 0 |  tx;    // rounded : target pixel's x
                tIndex = yIndex + tX * 4; // target pixel index within target array
                crossX = (tX != (0 | tx + scale));
                if (crossX) { // if pixel is crossing target pixel's right
                    wx = (tX + 1 - tx); // weight of point within target pixel
                    nwx = (tx + scale - tX - 1); // ... within x+1 target pixel
                }
                sR = sBuffer[sIndex    ];   // retrieving r,g,b for curr src px.
                sG = sBuffer[sIndex + 1];
                sB = sBuffer[sIndex + 2];
                sA = sBuffer[sIndex + 3];
                
                if (!crossX && !crossY) { // pixel does not cross
                    // just add components weighted by squared scale.
                    tBuffer[tIndex    ] += sR * sqScale;
                    tBuffer[tIndex + 1] += sG * sqScale;
                    tBuffer[tIndex + 2] += sB * sqScale;
                    tBuffer[tIndex + 3] += sA * sqScale;
                } else if (crossX && !crossY) { // cross on X only
                    w = wx * scale;
                    // add weighted component for current px
                    tBuffer[tIndex    ] += sR * w;
                    tBuffer[tIndex + 1] += sG * w;
                    tBuffer[tIndex + 2] += sB * w;
                    tBuffer[tIndex + 3] += sA * w;
                    // add weighted component for next (tX+1) px                
                    nw = nwx * scale
                    tBuffer[tIndex + 4] += sR * nw; // not 3
                    tBuffer[tIndex + 5] += sG * nw; // not 4
                    tBuffer[tIndex + 6] += sB * nw; // not 5
                    tBuffer[tIndex + 7] += sA * nw; // not 6
                } else if (crossY && !crossX) { // cross on Y only
                    w = wy * scale;
                    // add weighted component for current px
                    tBuffer[tIndex    ] += sR * w;
                    tBuffer[tIndex + 1] += sG * w;
                    tBuffer[tIndex + 2] += sB * w;
                    tBuffer[tIndex + 3] += sA * w;
                    // add weighted component for next (tY+1) px                
                    nw = nwy * scale
                    tBuffer[tIndex + 4 * tw    ] += sR * nw; // *4, not 3
                    tBuffer[tIndex + 4 * tw + 1] += sG * nw; // *4, not 3
                    tBuffer[tIndex + 4 * tw + 2] += sB * nw; // *4, not 3
                    tBuffer[tIndex + 4 * tw + 3] += sA * nw; // *4, not 3
                } else { // crosses both x and y : four target points involved
                    // add weighted component for current px
                    w = wx * wy;
                    tBuffer[tIndex    ] += sR * w;
                    tBuffer[tIndex + 1] += sG * w;
                    tBuffer[tIndex + 2] += sB * w;
                    tBuffer[tIndex + 3] += sA * w;
                    // for tX + 1; tY px
                    nw = nwx * wy;
                    tBuffer[tIndex + 4] += sR * nw; // same for x
                    tBuffer[tIndex + 5] += sG * nw;
                    tBuffer[tIndex + 6] += sB * nw;
                    tBuffer[tIndex + 7] += sA * nw;
                    // for tX ; tY + 1 px
                    nw = wx * nwy;
                    tBuffer[tIndex + 4 * tw    ] += sR * nw; // same for mul
                    tBuffer[tIndex + 4 * tw + 1] += sG * nw;
                    tBuffer[tIndex + 4 * tw + 2] += sB * nw;
                    tBuffer[tIndex + 4 * tw + 3] += sA * nw;
                    // for tX + 1 ; tY +1 px
                    nw = nwx * nwy;
                    tBuffer[tIndex + 4 * tw + 4] += sR * nw; // same for both x and y
                    tBuffer[tIndex + 4 * tw + 5] += sG * nw;
                    tBuffer[tIndex + 4 * tw + 6] += sB * nw;
                    tBuffer[tIndex + 4 * tw + 7] += sA * nw;
                }
            } // end for sx 
        } // end for sy

        // create result canvas
        var resCV = document.createElement('canvas');
        resCV.width = tw;
        resCV.height = th;
        var resCtx = resCV.getContext('2d');
        var imgRes = resCtx.getImageData(0, 0, tw, th);
        var tByteBuffer = imgRes.data;
        // convert float32 array into a UInt8Clamped Array
        var pxIndex = 0; //  
        for (sIndex = 0, tIndex = 0; pxIndex < tw * th; sIndex += 4, tIndex += 4, pxIndex++) {
            tByteBuffer[tIndex] = Math.ceil(tBuffer[sIndex]);
            tByteBuffer[tIndex + 1] = Math.ceil(tBuffer[sIndex + 1]);
            tByteBuffer[tIndex + 2] = Math.ceil(tBuffer[sIndex + 2]);
            tByteBuffer[tIndex + 3] = Math.ceil(tBuffer[sIndex + 3]);
        }
        // writing result to canvas.
        resCtx.putImageData(imgRes, 0, 0);
        return resCV;
    }

    return function () {
        return {
            downScaleImage: downScaleImage,
            downScaleCanvas: downScaleCanvas
        }; // reference to the singleton caught in the closure.
    }
})());
