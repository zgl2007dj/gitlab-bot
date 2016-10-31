#!/usr/bin/env node
var express = require('express');
var bodyParser = require('body-parser');
var k8s = require('k8s');
var moment = require('moment');
var fs = require('fs');
var app = express();
var request = require('request');

var kubectl = k8s.kubectl({
    endpoint: 'http://master:8080',
    binary: '/Users/zouguoliang/Desktop/workspace/kubectl'
});

var GIT_HOST = 'http://192.168.204.42/';
var PRIVATE_TOKEN = 'xTMmiBFyP8_UNycXD8Hp'; //'mP11bj13Vdm7zVxXrF43';
var TRIGGER_TOKEN = '17bbe493f28bb3fa65c512d40fcaf7';

var PORT =  process.env.PORT || 3002;
app.set('port', PORT);
app.use(bodyParser.json());

app.use('/test', function(req, res){
    GetCiID(60 , function(err, ci){
        console.log(err)
        console.log(ci)
        MergeRequestNote(60, 1, 'heheda123')
    })
    res.send('ok')
})


//部署服务
app.use('/depoly', function(req, res) {
    console.log('部署结果：' + req.body);
    var relicationName = req.body.relicationName;
    var image = req.body.image;
    kubectl.rc.rollingUpdate(relicationName, image, function(err, data) {
        if (err == null) {
            console.log('部署似乎已经完成! www-dev');
        } else {
            console.log('抱歉！ 部署 失败!' + err);
        }
    });
    res.send('ok');
});

app.use('/trigger-ci', function(req, res, next) {
    var object_kind = req.body.object_kind;
    var object_attributes = req.body.object_attributes;
    console.log('kind:' + object_kind);
    console.log(req.body);

    if (object_kind == 'note') {

        if (object_attributes.noteable_type == 'MergeRequest') {
            if (object_attributes.note == 'test') {
                console.log(object_attributes);
                MergeRequestNote(object_attributes.project_id,
                    req.body.merge_request.id,
                    '我们的征途是星辰大海');
            } else if (object_attributes.note.trim() == '看美女') {
                GetWomenPhoto(function(url) {
                    MergeRequestNote(object_attributes.project_id,
                        req.body.merge_request.id,
                        '![美女](' + url + ')');
                });
            } else if (object_attributes.note.trim() == '讲笑话') {
                GetJoke(function(joke) {
                    MergeRequestNote(object_attributes.project_id,
                        req.body.merge_request.id,
                        joke.title + '\r\n\r\n' + joke.text);
                });
            } else if (object_attributes.note.trim() == '合并后部署') {
                MergeRequestNote(object_attributes.project_id,
                    req.body.merge_request.id,
                    '好的! 当这个分支成功合并后 我会触发部署服务! \r\n ![fax_nick](http://ww1.sinaimg.cn/large/74311666jw1f1qaa18su7j20dw08zgmb.jpg)');
            }
        }
    } else if (object_kind == 'merge_request') {

        if (object_attributes.action == 'open' || object_attributes.action == 'reopen') {

            MergeRequestNote(object_attributes.target_project_id,
                object_attributes.id,
                '您好! 尼克狐为您服务! 合并请求通过后需要我做些什么吗? 例如: 合并后部署 讲笑话 看美女 ? \r\n ![DC_W_LVGKY6H7RYX8F__WWI](http://ww1.sinaimg.cn/large/74311666jw1f1qa9kmjmcj206h08cdg2.jpg)');
        } else if (object_attributes.action == 'merge') {
            //遍历commit
            GetMergeNotes(object_attributes.target_project_id,
                object_attributes.id, function(err, notes) {
                    for (index in notes) {
                        if (notes[index].body.trim() == '合并后部署') {
                            GetCiID(object_attributes.target_project_id, function(err, ci) {
                                InvokeTrigger(ci, object_attributes.target_branch, function(err, ciResult) {
                                    MergeRequestNote(object_attributes.target_project_id,
                                        object_attributes.id, '我已成功触发自动构建 [View build details](' + object_attributes.target.web_url + '/commit/' + JSON.parse(ciResult).commit.sha + '/builds)');
                                });
                            });
                            break;
                        }
                    }
                });
        }
    }

    res.send("ok");
});

function GetMergeNotes(projectId, mergeRequestId, cb) {

    request({
        url: GIT_HOST + '/api/v3/projects/' + projectId +
            '/merge_requests/' + mergeRequestId + '/notes',
        method: 'GET',
        headers: {
            'PRIVATE-TOKEN': PRIVATE_TOKEN
        }
    }, function(err, response, body) {
        if (!err && response.statusCode == 200) {
            var data = JSON.parse(body)
            cb(null, data);
        }
    });
}

//评论
function MergeRequestNote(projectId, mergeRequestId, note) {
    request({
        url: GIT_HOST + '/api/v3/projects/' + projectId +
            '/merge_requests/' + mergeRequestId + '/notes?body=' + note,
        method: 'POST',
        headers: {
            'PRIVATE-TOKEN': PRIVATE_TOKEN
        }
    });
}

//获取嘿嘿嘿
function GetWomenPhoto(cb) {
    var i = Math.floor(Math.random() * 100);
    request.get('http://www.tngou.net/tnfs/api/news?id=' + i + '&rows=100', function(err, r, body) {
        if (!err && r.statusCode == 200) {
            var data = JSON.parse(body)
            var i = Math.floor(Math.random() * 100);
            cb && cb('http://tnfs.tngou.net/img' + data.tngou[i].img);
        }
    });
}

//获取一个笑话
function GetJoke(cb) {

    var year = moment().format("YYYY");
    var timestamp = moment().format("YYYYMMDDHHmmss");

    var i = Math.floor(Math.random() * 100);
    request.get('http://route.showapi.com/341-1?showapi_appid=16508&showapi_timestamp=' + timestamp + '&showapi_sign=58752887c0fd4e8aa42e2282182da999&time=' + year + '-01-01&page=' + i + '&maxResult=20&', function(err, r, body) {
        if (!err && r.statusCode == 200) {
            var data = JSON.parse(body);
            if (data.showapi_res_code == 0 && data.showapi_res_body.contentlist.length > 0) {
                var contentlist = data.showapi_res_body.contentlist;

                cb(contentlist[Math.floor(Math.random() * 20)]);
            }
        }
    });
}

//触发一个构建
//触发构建的时候携带了一个variables参数,在编写.gitlab-ci.yml脚本的时候可以判断这个参数从而进行自动部署
//类似这样
//  - if [ -n "${DOCKER_BUILD}" ]; then
//  -  YOU DEPOLY SCRIPT
//  - fi
function InvokeTrigger(id, branch, cb) {
    request.post({
        url: GIT_HOST + '/ci/api/v1/projects/' + id + '/refs/' + branch + '/trigger',
        form: {
            'token': TRIGGER_TOKEN,
            'variables[DOCKER_BUILD]': true
        }
    }, function(err, response, body) {
        cb && cb(err, body)
    });

}

//获取ciID
function GetCiID(project_id, cb) {
    request({
        url: GIT_HOST + '/ci/api/v1/projects/',
        method: 'GET',
        headers: {
            'PRIVATE-TOKEN': PRIVATE_TOKEN
        }
    }, function(err, response, body) {
        var ci = null;
        if (!err && response.statusCode == 200) {
            var data = JSON.parse(body)
            for (index in data) {
                if (data[index].gitlab_id == project_id) {
                    ci = data[index].id;
                    break;
                }
            }
        }
        cb(err, ci)
    });
}

var server = app.listen(app.get('port'), function() {
    console.log("Server is start at:" + PORT);
});

process.on('SIGINT', function() {
    console.log("exit.");
    process.exit(0);
});
