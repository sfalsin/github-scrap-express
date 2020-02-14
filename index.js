"use strict";
const path = require('path');
var axios = require('axios');
var cheerio = require('cheerio');
var bodyParser = require("body-parser");
var mcache = require('memory-cache');
const GITHUB_URL = 'https://github.com';

var express = require('express');
var app = express();

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


var cache = (duration) => {
    return (req, res, next) => {
        let key = '__express__' + req.body.user + req.body.repo || req.url
        let cachedBody = mcache.get(key)
        if (cachedBody) {
            res.send(JSON.parse(cachedBody));
            return
        } else {
            res.sendResponse = res.send
            res.send = (body) => {
                mcache.put(key, body, duration * 1000);
                res.sendResponse(body)
            }
            next()
        }
    }
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('ok')
});

app.post('/', cache(300), async function(req, res) {
    try {

        var repo = '/' + req.body.user + '/' + req.body.repo;


        var resArray = await listLinks(GITHUB_URL, repo, '', 0);
        var obj = {};
        var total = 0;
        resArray.forEach((value, key) => {
            var keys = key.split('.'),
                last = keys.pop();
            keys.reduce((r, a) => r[a] = r[a] || {}, obj)[last] = value;
            total = total + value;
        });
        obj['totalBytes'] = total;
        res.json(obj);

    } catch (e) {
        console.error(e.message);
        return res.status(500).json({
            status: 'error',
            message: e.message
        })

    }

});

module.exports = app

//expressOasGenerator.handleRequests();
app.listen(3000, function() {
    console.log('App Github Scrap running at port 3000!');
});


async function listLinks(urlBase, repo, urlPath, level) {
    var link;
    try {
        link = await axios.get(urlBase + repo + urlPath);
    } catch (error) {
        throw new Error('Invalid url!');
    }


    var resArray = new Map();
    if (link.data.length > 0) {

        let $ = cheerio.load(link.data);
        var res;
        var links = [];
        $('a').each(function(i, e) {
            if (!links.find(item => item == $(e).attr('href'))) {
                links[i] = $(e).attr('href');
            }
        });

        //for (const link of links) {
        const promises = links.map(async(link, idx) => {

            if (link != undefined && link.replace('/blob', '').replace('/tree', '').startsWith(repo + urlPath.replace('/tree', ''))) {

                if (link.replace(repo, '').startsWith("/blob/master")) {

                    if (link.replace(repo, '').replace("/blob/master", '') != "" && link.indexOf('?') == -1) {
                        var res = await countLines(GITHUB_URL + repo, link.replace(repo, ''));

                        if (resArray.get(res.type) == undefined) {
                            resArray.set(res.type, res.lines);
                        } else {
                            var qtdNum = resArray.get(res.type);
                            resArray.set(res.type, qtdNum + res.lines);
                        }
                    }

                } else if (link != undefined && link.replace(repo, '').startsWith("/tree/master")) {

                    var tmpMap = await listLinks(urlBase, repo, link.replace(repo, ''), (level + 1));

                    tmpMap.forEach(function(value, key) {
                        if (resArray.get(key) == undefined) {
                            resArray.set(key, value);
                        } else {
                            var qtdNum = resArray.get(key);
                            resArray.set(key, qtdNum + value);
                        }
                    });

                }
            }

        });
        await Promise.all(promises);

    } else {
        console.error("Empty url!");
    }
    return resArray;
}

async function countLines(url, file) {
    try {
        var res = await axios.get(url + file);
        let $ = cheerio.load(res.data);
        var content = $('body > div.application-main > div > main > div.container-lg.clearfix.new-discussion-timeline.p-responsive > div > div.Box.mt-3.position-relative > div.Box-header.py-2.d-flex.flex-column.flex-shrink-0.flex-md-row.flex-md-items-center > div.text-mono.f6.flex-auto.pr-3.flex-order-2.flex-md-order-1.mt-2.mt-md-0').html();

        var byteSize = extractBytesFromText(content);
        var extension = extractExtension(file);

        return {
            type: extension,
            lines: byteSize
        }
    } catch (e) {
        console.log('Erro na url : ' + url + file);
    }

}

function extractExtension(text) {
    if (text.lastIndexOf("\.") > 1 && text.lastIndexOf("\/") < text.lastIndexOf("\.")) {
        return text.substring(text.lastIndexOf("\.") + 1, text.length);
    } else {
        return "no extension";
    }

}

function extractBytesFromText(text) {
    var multiply = 1;
    var dirtySize;
    if (text != undefined) {
        var tmp = text.split('<span class="file-info-divider"></span>');
        dirtySize = tmp[tmp.length - 1].trim();
    } else {
        dirtySize = "0";
    }
    if (dirtySize.lastIndexOf('KB') > 0) {
        multiply = 1000;
    } else if (dirtySize.lastIndexOf('MB') > 0) {
        multiply = 1000000;
    }
    var finalSize = Number(dirtySize.replace(/[^0-9\.]+/g, ""));

    return Number((finalSize * multiply).toFixed());
}