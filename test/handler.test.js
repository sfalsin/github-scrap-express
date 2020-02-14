'use strict';

var chai = require('chai');
var chaiHttp = require('chai-http');
var MockAdapter = require('axios-mock-adapter');
var should = chai.should();
var fs = require('fs');
chai.use(chaiHttp);

var payloadTest = {
    user: 'MunGell',
    repo: 'awesome-for-beginners'
};

var wrongPayloadTest = {
    user: 'user1',
    repo: 'repo1'
};

var urlBase = 'https://github.com';


describe('Test for Github Scrap', function() {

    var axios = require('axios');
    var mock = new MockAdapter(axios);
    var server = require('../index');


    it('post at / endpoint with a valid payload ', function(done) {

        var contentMain = fs.readFileSync('test/resources/data_test.html', 'utf8');
        var contentFile1 = fs.readFileSync('test/resources/CONTRIBUTING.md', 'utf8');
        var contentFile2 = fs.readFileSync('test/resources/README.md', 'utf8');

        mock.onGet(urlBase + '/' + payloadTest.user + '/' + payloadTest.repo).reply(200, contentMain);
        mock.onGet(urlBase + '/' + payloadTest.user + '/' + payloadTest.repo + '/blob/master/CONTRIBUTING.md').reply(200, contentFile1);
        mock.onGet(urlBase + '/' + payloadTest.user + '/' + payloadTest.repo + '/blob/master/README.md').reply(200, contentFile2);

        //var server = require('../index');

        chai.request(server)
            .post('/')
            .send(payloadTest)
            .end(function(err, res, body) {
                res.body.should.be.eql({ md: 36030, totalBytes: 36030 });
                res.should.have.status(200);
                done();
            });

    });

    it('post at / endpoint with a wrong payload ', function(done) {


        mock.onGet(urlBase + '/' + wrongPayloadTest.user + '/' + wrongPayloadTest.repo).reply(500);


        chai.request(server)
            .post('/')
            .send(wrongPayloadTest)
            .end(function(err, res, body) {
                res.should.have.status(500);
                done();
            });

    });

    it('get at / endpoint healthcheck', function(done) {

        //var server = require('../index');

        mock.onGet(urlBase + '/' + payloadTest.user + '/' + payloadTest.repo).reply(500);
        chai.request(server)
            .get('/')
            .end(function(err, res) {
                res.should.have.status(200);
                done();
            });

    });

});